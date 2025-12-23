// 1. Configuração do Banco de Dados Offline (IndexedDB)
let db;
const request = indexedDB.open("JGUA_DB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    // Cria a "tabela" de cadastros se não existir
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
};

request.onsuccess = (e) => { db = e.target.result; console.log("Banco pronto!"); };

// 2. Lógica de Busca de CEP (Híbrida: Local + Online)
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, ''); // Remove hífen
    if (cep.length !== 8) return;

    // A. Busca na base local (seu JSON)
    try {
        const response = await fetch('cep_base.json');
        const baseLocal = await response.json();
        const encontrado = baseLocal.find(c => c.cep === cep);

        if (encontrado) {
            preencherCampos(encontrado);
            return; // Encontrou local, encerra aqui
        }
    } catch (e) { console.log("Erro ao ler base local ou offline."); }

    // B. Se não achou local e tem internet, busca no ViaCEP
    if (navigator.onLine) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(res => res.json())
            .then(dados => {
                if (!dados.erro) preencherCampos(dados);
            });
    } else {
        alert("CEP não encontrado na base local e você está sem internet.");
    }
}

function preencherCampos(dados) {
    document.getElementById('logradouro').value = dados.logradouro || '';
    document.getElementById('bairro').value = dados.bairro || '';
    document.getElementById('cidade').value = dados.localidade || '';
    document.getElementById('uf').value = dados.uf || '';
}

// 3. Função para Salvar Cadastro
function salvar() {
    const registro = {
        nome: document.getElementById('nome').value,
        cpf: document.getElementById('cpf').value,
        cep: document.getElementById('cep').value.replace(/\D/g, ''),
        logradouro: document.getElementById('logradouro').value,
        data_cadastro: new Date().toLocaleString()
    };

    const transaction = db.transaction(["cadastros"], "readwrite");
    const store = transaction.objectStore("cadastros");
    store.add(registro);

    transaction.oncomplete = () => {
        alert("Cadastro salvo localmente com sucesso!");
        document.getElementById('nome').value = ''; // Limpa campo
    };
}
