//indexedDB.deleteDatabase("JGUA_DB");
//https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Aumentamos para 5 para forçar o navegador a aceitar a nova estrutura de ID (Texto)
const request = indexedDB.open("JGUA_DB", 5);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (db.objectStoreNames.contains("cadastros")) {
        db.deleteObjectStore("cadastros"); // Limpa a versão antiga para evitar conflitos de ID
    }
    const store = db.createObjectStore("cadastros", { keyPath: "id" });
    store.createIndex("cpf", "cpf", { unique: true });

    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
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
    if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
}

// --- LOGIN E PERMISSÕES ---
function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    const consulta = store.get(cod);

    consulta.onsuccess = () => {
        const u = consulta.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            if(u.perfil === "GESTOR") {
                if(document.getElementById('secao-admin-users')) document.getElementById('secao-admin-users').classList.remove('hidden');
            }
            atualizarMonitor();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR / EDITAR ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    const userAtual = window.labelNomeUser_Forced || document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!nome) return alert("O Nome é obrigatório!");

    const registro = {
        id: editId || "CAD-" + new Date().getTime(), // Mantém o ID original ou gera um novo
        tipo: document.getElementById('tipo').value, 
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpfValor,
        sexo: document.getElementById('sexo').value,
        nascimento: document.getElementById('nascimento').value,
        whatsapp: document.getElementById('whatsapp').value.replace(/\D/g, ''),
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        origem: document.getElementById('origem').value,
        criado_por: userAtual,
        criado_em: new Date().toLocaleString()
    };

    if (editId) {
        registro.id = editId; // CORREÇÃO: Removido o Number() para aceitar o ID "CAD-..."
        registro.atualizado_por = userAtual;
        registro.atualizado_em = new Date().toLocaleString();
    }

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        store.put(registro);

        tx.oncomplete = () => {
            alert(editId ? "Cadastro atualizado!" : "Cadastro realizado!");
            cancelarEdicao();
            atualizarMonitor();
        };
    } catch (e) { alert("Erro ao salvar."); }
}

// --- CARREGAR PARA EDIÇÃO ---
function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        document.getElementById('edit-id').value = r.id;
        document.getElementById('nome').value = r.nome;
        document.getElementById('sobrenome').value = r.sobrenome;
        document.getElementById('cpf').value = r.cpf;
        document.getElementById('sexo').value = r.sexo;
        document.getElementById('nascimento').value = r.nascimento;
        document.getElementById('whatsapp').value = r.whatsapp;
        document.getElementById('email').value = r.email;
        document.getElementById('cep').value = r.cep;
        document.getElementById('bairro').value = r.bairro;
        document.getElementById('logradouro').value = r.logradouro;
        document.getElementById('numero').value = r.numero;

        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() {
    document.getElementById('edit-id').value = "";
    document.getElementById('titulo-form').innerText = "Novo Cadastro";
    document.getElementById('botoes-acao').classList.remove('hidden');
    document.getElementById('botoes-edicao').classList.add('hidden');
    const campos = ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero"];
    campos.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ""; });
}

// --- MONITOR E BUSCA ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;

        const filtrados = registros.filter(r => 
            r.nome.toLowerCase().includes(termo) || 
            r.sobrenome.toLowerCase().includes(termo) || 
            r.cpf.includes(termo) || 
            (r.bairro && r.bairro.toLowerCase().includes(termo))
        );

        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `
                <div class="item-lista" onclick="prepararEdicao('${r.id}')"> 
                    <strong>${r.nome} ${r.sobrenome}</strong> <small>(${r.bairro || 'Sem Bairro'})</small><br>
                    <span style="font-size:0.75em; color:#777;">CPF: ${r.cpf}</span>
                </div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";
    };
}

// --- BUSCA CEP ---
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
        const response = await fetch('cep_base_jgs.json');
        const base = await response.json();
        const r = base[cep];
        if (r) {
            document.getElementById('logradouro').value = r[0].logradouro;
            document.getElementById('bairro').value = r[0].bairro;
        } else { throw new Error(); }
    } catch (e) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
            if(!d.erro) {
                document.getElementById('logradouro').value = d.logradouro;
                document.getElementById('bairro').value = d.bairro;
            }
        });
    }
}

// --- SINCRONIZAÇÃO ---
async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => {
            console.log("Sincronização OK!");
            if(document.getElementById('contador-total')) atualizarMonitor();
        };
    } catch (error) { console.error("Erro na nuvem:", error); }
}
