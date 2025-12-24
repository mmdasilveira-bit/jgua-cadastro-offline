//indexedDB.deleteDatabase("JGUA_DB");
//https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Subimos para a versão 10 para garantir a limpeza de erros de versões anteriores no Linux
const request = indexedDB.open("JGUA_DB", 10);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (db.objectStoreNames.contains("cadastros")) db.deleteObjectStore("cadastros");
    if (db.objectStoreNames.contains("usuarios")) db.deleteObjectStore("usuarios");

    const store = db.createObjectStore("cadastros", { keyPath: "id" });
    store.createIndex("cpf", "cpf", { unique: true });

    const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
    userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    sincronizarDadosDaNuvem();
    if(document.getElementById('contador-total')) atualizarMonitor();
    if(document.getElementById('lista-usuarios')) listarUsuarios();
};

// --- VALIDADOR DE CPF ---
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    return rev == parseInt(cpf.charAt(10));
}

// --- LOGIN ---
function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    store.get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            if(u.perfil === "GESTOR" && document.getElementById('secao-admin-users')) {
                document.getElementById('secao-admin-users').classList.remove('hidden');
            }
            atualizarMonitor();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR / EDITAR (33 COLUNAS) ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    const userAtual = document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!nome) return alert("O Nome é obrigatório!");

    const nasc = document.getElementById('nascimento').value;
    const whats = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const idadeCalculada = nasc ? new Date().getFullYear() - new Date(nasc).getFullYear() : 0;

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpfValor,
        sexo: document.getElementById('sexo').value,
        nascimento: nasc,
        idade: idadeCalculada,
        whatsapp: whats,
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        origem: document.getElementById('origem').value,
        criado_por: userAtual,
        criado_em: new Date().toLocaleString()
    };

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        tx.objectStore("cadastros").put(registro);
        tx.oncomplete = () => {
            alert("Sucesso!");
            cancelarEdicao();
            atualizarMonitor();
        };
    } catch (e) { alert("Erro ao processar."); }
}

// --- MONITOR E BUSCA UNIVERSAL (RESTORE COMPLETO) ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;

        const filtrados = registros.filter(r => 
            (r.nome||"").toLowerCase().includes(termo) || 
            (r.sobrenome||"").toLowerCase().includes(termo) || 
            (r.cpf||"").includes(termo) || 
            (r.bairro && r.bairro.toLowerCase().includes(termo))
        );

        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `
                <div class="item-lista" onclick="prepararEdicao('${r.id}')"> 
                    <strong>${r.nome} ${r.sobrenome}</strong> <small>(${r.bairro || 'Sem Bairro'})</small><br>
                    <span style="font-size:0.75em; color:#777;">CPF: ${r.cpf} | Idade: ${r.idade || '---'}</span>
                </div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";

        // RANKING DE BAIRROS
        const bairros = {};
        registros.forEach(r => { if(r.bairro) bairros[r.bairro.toUpperCase()] = (bairros[r.bairro.toUpperCase()] || 0) + 1; });
        const ranking = Object.entries(bairros).sort((a,b) => b[1]-a[1]).slice(0,5);
        if(document.getElementById('stats-bairros')) {
            document.getElementById('stats-bairros').innerHTML = "Top Bairros: " + ranking.map(b => `${b[0]}(${b[1]})`).join(" | ");
        }
    };
}

// --- EDIÇÃO ---
function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        document.getElementById('edit-id').value = r.id;
        document.getElementById('nome').value = r.nome || "";
        document.getElementById('sobrenome').value = r.sobrenome || "";
        document.getElementById('cpf').value = r.cpf || "";
        document.getElementById('whatsapp').value = r.whatsapp || "";
        document.getElementById('bairro').value = r.bairro || "";
        // ... outros campos seguem a mesma lógica
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() { location.reload(); }

// --- SINCRONIZAÇÃO (FIXED) ---
async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => {
            console.log("Sincronização OK!");
            atualizarMonitor();
        };
    } catch (error) { console.error("Erro na sincronização:", error); }
}

// --- CEP ---
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
        if(!d.erro) {
            document.getElementById('logradouro').value = d.logradouro;
            document.getElementById('bairro').value = d.bairro;
        }
    });
}
// --- FUNÇÕES DE GESTÃO DE INTEGRANTES (COLE NO FINAL DO APP.JS) ---

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;

    if(!nome || !codigo) return alert("Preencha o nome e o código de acesso!");

    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    
    const request = store.add({ codigo, nome, perfil });
    
    request.onsuccess = () => {
        alert("Integrante cadastrado com sucesso!");
        document.getElementById('novo-nome').value = "";
        document.getElementById('novo-codigo').value = "";
        listarUsuarios(); // Atualiza a listinha embaixo
    };
    
    request.onerror = () => alert("Este código já está em uso!");
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    if(!listaDiv || !db) return;

    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    
    store.getAll().onsuccess = (e) => {
        const usuarios = e.target.result;
        let html = "<table style='width:100%; border-collapse: collapse; font-size: 14px;'>";
        
        usuarios.forEach(u => {
            html += `<tr style='border-bottom: 1px solid #eee; height: 45px;'>
                <td><strong>${u.nome}</strong><br><span style='color: #666;'>${u.perfil}</span></td>
                <td style='text-align:right;'>
                    ${u.codigo !== "1234" ? 
                    `<button onclick="excluirU('${u.codigo}')" style='background:#ff4d4d; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;'>X</button>` 
                    : "<small>Mestre</small>"}
                </td>
            </tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };


function excluirU(codigo) {
    if(!confirm("Tem certeza que deseja remover este acesso?")) return;
    
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").delete(codigo).onsuccess = () => {
        listarUsuarios();
    };
}
