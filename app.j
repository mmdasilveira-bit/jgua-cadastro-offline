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
    async function buscarCEP() {
    let campoCep = document.getElementById('cep');
    let cep = campoCep.value.replace(/\D/g, ''); // Remove hifens
    
    if (cep.length !== 8) return;

    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        
        // Como seu JSON é um dicionário, acessamos direto pela chave:
        const resultado = baseLocal[cep]; 

        if (resultado && resultado.length > 0) {
            // Pegamos o primeiro item da lista daquele CEP
            const dados = resultado[0];
            document.getElementById('logradouro').value = dados.logradouro || '';
            document.getElementById('bairro').value = dados.bairro || '';
            document.getElementById('cidade').value = dados.cidade || 'Jaraguá do Sul';
            document.getElementById('uf').value = dados.uf || 'SC';
            console.log("Dados preenchidos via base local!");
        } else if (navigator.onLine) {
            // Se não achou na base local, tenta ViaCEP
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();
            if (!dados.erro) {
                document.getElementById('logradouro').value = dados.logradouro;
                document.getElementById('bairro').value = dados.bairro;
                document.getElementById('cidade').value = dados.localidade;
                document.getElementById('uf').value = dados.uf;
            }
        }
    } catch (e) {
        console.error("Erro na busca:", e);
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
