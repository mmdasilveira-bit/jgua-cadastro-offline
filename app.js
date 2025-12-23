let db;
const request = indexedDB.open("JGUA_DB", 2); // Aumentamos a versão para 2

request.onupgradeneeded = (e) => {
    db = e.target.result;
    // Tabela de Cadastros
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
    // NOVA: Tabela de Usuários do Sistema
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        
        // Criamos o GESTOR MESTRE padrão para você não ficar trancado fora
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => { db = e.target.result; };

async function buscarCEP() {
    let campoCep = document.getElementById('cep');
    let cep = campoCep.value.replace(/\D/g, ''); 
    
    if (cep.length !== 8) return;

    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        
        const resultado = baseLocal[cep]; 

        if (resultado && resultado.length > 0) {
            const dados = resultado[0];
            document.getElementById('logradouro').value = dados.logradouro || '';
            document.getElementById('bairro').value = dados.bairro || '';
            document.getElementById('cidade').value = dados.cidade || 'Jaraguá do Sul';
            document.getElementById('uf').value = dados.uf || 'SC';
        } else if (navigator.onLine) {
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
        console.error("Erro ao carregar base de CEPs:", e);
    }
}

function salvar() {
    const perfil = document.getElementById('label-perfil').innerText;
    const registro = {
        nome: document.getElementById('nome').value,
        cpf: document.getElementById('cpf').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        data: new Date().toLocaleString(),
        perfil_autor: perfil
    };

    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").add(registro);
    tx.oncomplete = () => {
        alert("Salvo com sucesso!");
        document.getElementById('nome').value = "";
        document.getElementById('cpf').value = "";
    };
}

function exportarDados() {
    const perfil = document.getElementById('label-perfil').innerText;
    const tx = db.transaction("cadastros", "readonly");
    tx.objectStore("cadastros").getAll().onsuccess = (e) => {
        let dados = e.target.result;
        if (perfil !== "GESTOR") {
            dados = dados.map(item => ({ ...item, cpf: "***.***.***-**" }));
        }
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cadastros_jgua.json`;
        a.click();
    };
}
