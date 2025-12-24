// 1. COLE AQUI A URL QUE VOCÊ COPIOU DO GOOGLE APPS SCRIPT (PASSO 10)
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwYtG7KWEf9_yH4BvxmgNptrQNA1MtlMXPlro-TN_Kd2lrY-WoiGYcrc8sxDvziTEeFzA/exec"; 

let db;
// Note que mantemos a versão 4 para garantir a estrutura correta
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
    console.log("Banco de dados carregado com sucesso!");
};

function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    const consulta = store.get(cod);

    consulta.onsuccess = () => {
        const usuario = consulta.result;
        if (usuario) {
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            alert("Bem-vindo, " + usuario.nome);
        } else { alert("Código incorreto!"); }
    };
}
