const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbzE3FsLK93I5SFMiWLgbfiwqXKTUSEvShWqCkqk7-GJU7suzP5vBWRcDnRgDUZy_KtHfQ/exec"; 

let db;
const request = indexedDB.open("JGUA_DB", 4);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        const store = db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
        store.createIndex("cpf", "cpf", { unique: true });
    }
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    console.log("Sistema JGUA carregado.");
    if(document.getElementById('contador-total')) atualizarMonitor();
};

// --- FUNÇÃO SALVAR (CAPTURA TODOS OS CAMPOS) ---
async function salvar() {
    // Verificações Básicas
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    if (!nome || !cpfValor) return alert("Nome e CPF são obrigatórios!");

    const nasc = document.getElementById('nascimento').value;
    const dataNasc = new Date(nasc);
    let idadeCalculada = new Date().getFullYear() - dataNasc.getFullYear();

    // Criando o objeto com TODOS os campos para a planilha
    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value || "AUTO",
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpfValor,
        nascimento: nasc,
        idade: idadeCalculada,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        instagram: document.getElementById('instagram')?.value || "",
        telegram: document.getElementById('telegram')?.value || "",
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        data_cadastro: new Date().toLocaleString(),
        autor: document.getElementById('label-perfil')?.innerText || "GESTOR MESTRE"
    };

    try {
        // Envio para o Google Sheets
        fetch(URL_PLANILHA, {
            method: 'POST',
            mode: 'no-cors', 
            body: JSON.stringify(registro)
        });
        
        salvarLocalmente(registro);
    } catch (error) {
        console.error("Erro na nuvem, salvando apenas local.");
        salvarLocalmente(registro);
    }
}

function salvarLocalmente(registro) {
    const tx = db.transaction("cadastros", "readwrite");
    const store = tx.objectStore("cadastros");
    const requestAdd = store.add(registro);
    
    requestAdd.onsuccess = () => {
        alert("Sucesso! Dados salvos e enviados.");
        limparCampos();
        atualizarMonitor();
    };
    requestAdd.onerror = () => alert("Erro: Este CPF já existe!");
}

function limparCampos() {
    const campos = ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero", "instagram", "telegram"];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
}

// --- MONITOR DE DADOS ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    
    store.getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        
        // Atualiza lista visual (últimos 5)
        const listaDiv = document.getElementById('lista-cadastros');
        if(listaDiv) {
            let html = '<table style="width:100%; font-size: 0.8em;">';
            registros.reverse().slice(0, 5).forEach(r => {
                html += `<tr style="border-bottom: 1px solid #eee;"><td>${r.nome}</td><td>${r.bairro}</td></tr>`;
            });
            listaDiv.innerHTML = html + '</table>';
        }
    };
}

// --- BUSCA CEP ---
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
            document.getElementById('logradouro').value = data.logradouro;
            document.getElementById('bairro').value = data.bairro;
        }
    } catch (e) { console.log("Erro CEP"); }
}
