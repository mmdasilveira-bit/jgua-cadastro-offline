// 1. Banco de Dados
let db;
const request = indexedDB.open("JGUA_DB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
};
request.onsuccess = (e) => { db = e.target.result; console.log("Banco de Dados Conectado!"); };

// 2. Busca de CEP Melhorada
async function buscarCEP() {
    let campoCep = document.getElementById('cep');
    let cep = campoCep.value.replace(/\D/g, ''); // Remove hifens e pontos
    
    if (cep.length !== 8) return;

    console.log("Buscando CEP:", cep);

    try {
        // Busca no arquivo de Jaraguá que você subiu
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        
        // Procura o CEP na sua lista
        const encontrado = baseLocal.find(c => c.cep.replace(/\D/g, '') === cep);

        if (encontrado) {
            console.log("Achou na base local!");
            preencherCampos(encontrado);
        } else if (navigator.onLine) {
            console.log("Não achou local, tentando ViaCEP...");
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();
            if (!dados.erro) preencherCampos(dados);
        } else {
            alert("CEP não encontrado localmente e você está offline.");
        }
    } catch (e) {
        console.error("Erro ao buscar CEP:", e);
    }
}

function preencherCampos(dados) {
    // Aqui usamos os nomes exatos do seu arquivo JSON
    document.getElementById('logradouro').value = dados.logradouro || '';
    document.getElementById('bairro').value = dados.bairro || '';
    document.getElementById('cidade').value = dados.localidade || dados.cidade || 'Jaraguá do Sul';
    document.getElementById('uf').value = dados.uf || 'SC';
}

// 3. Salvar com todos os campos do seu escopo
function salvar() {
    const perfil = document.getElementById('label-perfil').innerText;
    
    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value,
        nome: document.getElementById('nome').value,
        sobrenome: document.getElementById('sobrenome').value,
        cpf: document.getElementById('cpf').value,
        nascimento: document.getElementById('nascimento').value,
        email: document.getElementById('email').value,
        whatsapp: document.getElementById('whatsapp').value,
        instagram: document.getElementById('instagram').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        uf: document.getElementById('uf').value,
        obs: document.getElementById('obs').value,
        data_cadastro: new Date().toLocaleString(),
        perfil_autor: perfil
    };

    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").add(registro);
    tx.oncomplete = () => {
        alert("Cadastrado com sucesso!");
        // Limpa apenas os campos principais para o próximo
        document.getElementById('nome').value = "";
        document.getElementById('cpf').value = "";
    };
}
