//indexedDB.deleteDatabase("JGUA_DB");
//https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Versão 8 para garantir que seu Linux limpe qualquer resquício anterior
const request = indexedDB.open("JGUA_DB", 8);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (db.objectStoreNames.contains("cadastros")) db.deleteObjectStore("cadastros");
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

// --- SINCRONIZAÇÃO COM A NUVEM ---
async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => {
            console.log("Sincronização OK: " + registrosNuvem.length + " registros.");
            atualizarMonitor();
        };
    } catch (error) { console.error("Erro na nuvem:", error); }
}

// --- VALIDAÇÃO E LOGIN ---
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let add = 0; for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0; for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0;
    return rev == parseInt(cpf.charAt(10));
}

function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    db.transaction("usuarios", "readonly").objectStore("usuarios").get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            atualizarMonitor();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR E EDITAR ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    const userAtual = window.labelNomeUser_Forced || document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!nome) return alert("Nome obrigatório!");

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value,
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

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        tx.objectStore("cadastros").put(registro);
        tx.oncomplete = () => {
            alert("Sucesso!");
            cancelarEdicao();
            atualizarMonitor();
        };
    } catch (e) { alert("Erro ao salvar."); }
}

// --- MONITOR E BUSCA ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        const filtrados = registros.filter(r => (r.nome + r.sobrenome + r.cpf + (r.bairro||'')).toLowerCase().includes(termo));
        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')">
                <strong>${r.nome} ${r.sobrenome}</strong> <small>(${r.bairro || 'Sem Bairro'})</small><br>
                <span style="font-size:0.75em; color:#777;">CPF: ${r.cpf}</span>
            </div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";
    };
}

function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        const campos = ["nome", "sobrenome", "cpf", "sexo", "nascimento", "whatsapp", "email", "cep", "bairro", "logradouro", "numero"];
        campos.forEach(c => { if(document.getElementById(c)) document.getElementById(c).value = r[c] || ""; });
        document.getElementById('edit-id').value = r.id;
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
    document.querySelectorAll('input, select').forEach(el => { if(el.id !== 'tipo' && el.id !== 'origem') el.value = ""; });
}

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
