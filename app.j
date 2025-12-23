let db;
const request = indexedDB.open("JGUA_DB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
};

request.onsuccess = (e) => { db = e.target.result; };

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        const encontrado = baseLocal.find(c => c.cep === cep);

        if (encontrado) {
            preencherCampos(encontrado);
        } else if (navigator.onLine) {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();
            if (!dados.erro) preencherCampos(dados);
        }
    } catch (e) { console.error("Erro na busca de CEP"); }
}

function preencherCampos(dados) {
    document.getElementById('logradouro').value = dados.logradouro || '';
    document.getElementById('bairro').value = dados.bairro || '';
    document.getElementById('cidade').value = dados.localidade || '';
    document.getElementById('uf').value = dados.uf || '';
}

function salvar() {
    const perfil = document.getElementById('label-perfil').innerText;
    const registro = {
        nome: document.getElementById('nome').value,
        cpf: document.getElementById('cpf').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        uf: document.getElementById('uf').value,
        data: new Date().toLocaleString(),
        perfil_criador: perfil
    };

    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").add(registro);
    tx.oncomplete = () => {
        alert("Salvo com sucesso!");
        document.querySelectorAll('input').forEach(i => i.value = "");
    };
}

// Função para exportar os dados (Regra do CPF aqui!)
function exportarDados() {
    const perfil = document.getElementById('label-perfil').innerText;
    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    const request = store.getAll();

    request.onsuccess = () => {
        let dados = request.result;
        
        // REGRA DE OURO: Se não for GESTOR, mascara o CPF na exportação
        if (perfil !== "GESTOR") {
            dados = dados.map(item => ({
                ...item,
                cpf: "***.***.***-**" 
            }));
        }

        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cadastros_jgua_${perfil}.json`;
        a.click();
    };
}
