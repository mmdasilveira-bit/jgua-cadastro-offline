const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
const request = indexedDB.open("JGUA_FINAL_DB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    const store = db.createObjectStore("cadastros", { keyPath: "id" });
    store.createIndex("cpf", "cpf", { unique: true });
    const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
    userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    sincronizarDadosDaNuvem();
};

async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => { if(document.getElementById('contador-total')) atualizarMonitor(); };
    } catch (error) { console.error("Erro sincronia:", error); }
}

// --- LOGIN COM REGRAS DE PERFIL ---
function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    db.transaction("usuarios", "readonly").objectStore("usuarios").get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            
            // REGRAS DE VISIBILIDADE POR PERFIL
            if(u.perfil === "CADASTRADOR") {
                document.getElementById('monitor').classList.add('hidden');
            }
            if(u.perfil === "GESTOR") {
                document.getElementById('secao-admin-users')?.classList.remove('hidden');
            }
            
            atualizarMonitor();
            listarUsuarios();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR COM TODOS OS CAMPOS (33 COLUNAS) ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value;
    const userAtual = document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!nome || !cpf) return alert("Nome e CPF obrigatórios!");

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        origem: document.getElementById('origem').value,
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value,
        cpf: cpf,
        sexo: document.getElementById('sexo').value,
        nascimento: document.getElementById('nascimento').value,
        whatsapp: document.getElementById('whatsapp').value.replace(/\D/g, ''),
        celular2: document.getElementById('celular2')?.value || "",
        telefone_fixo: document.getElementById('telefone_fixo')?.value || "",
        email: document.getElementById('email').value,
        instagram: document.getElementById('instagram')?.value || "",
        telegram: document.getElementById('telegram')?.value || "",
        linkedin: document.getElementById('linkedin')?.value || "",
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        atualizado_por: userAtual,
        atualizado_em: new Date().toLocaleString()
    };

    // Auditoria de Criação
    if (!editId) {
        registro.criado_por = userAtual;
        registro.criado_em = new Date().toLocaleString();
    }

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        
        if (editId) {
            store.get(editId).onsuccess = (e) => {
                const original = e.target.result;
                registro.criado_por = original.criado_por;
                registro.criado_em = original.criado_em;
                store.put(registro);
            };
        } else { store.add(registro); }

        tx.oncomplete = () => { alert("Sucesso!"); location.reload(); };
    } catch (e) { alert("Erro ao salvar."); }
}

// --- MONITOR ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        const filtrados = registros.filter(r => (r.nome||"").toLowerCase().includes(termo) || (r.cpf||"").includes(termo));
        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')" style="border-bottom:1px solid #eee; padding:10px; cursor:pointer;">
                <strong>${r.nome}</strong> <small>(${r.bairro || '---'})</small><br>
                <span style="font-size:0.75em; color:#777;">CPF: ${r.cpf}</span></div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";
    };
}

// --- GESTÃO DE USUÁRIOS ---
function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Cadastrado!");
        listarUsuarios();
    };
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    if(!listaDiv) return;
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = "<table>";
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome} (${u.perfil})</td><td>${u.codigo !== '1234' ? `<button onclick="excluirU('${u.codigo}')">X</button>` : ''}</td></tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };
}

function excluirU(c) {
    if(confirm("Excluir?")) db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
}

function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        const campos = ["nome", "sobrenome", "cpf", "whatsapp", "email", "cep", "bairro", "logradouro", "numero", "tipo", "origem", "celular2", "telefone_fixo", "instagram", "telegram", "linkedin"];
        campos.forEach(c => { if(document.getElementById(c)) document.getElementById(c).value = r[c] || ""; });
        document.getElementById('edit-id').value = r.id;
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() { location.reload(); }

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
            if(!d.erro) {
                document.getElementById('logradouro').value = d.logradouro;
                document.getElementById('bairro').value = d.bairro;
            }
        });
    }
}
