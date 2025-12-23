let db;
const request = indexedDB.open("JGUA_DB", 2);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    if(!document.getElementById('conteudo').classList.contains('hidden')) {
        atualizarMonitor();
    }
};

// --- MONITOR E ESTATÍSTICAS ---

function atualizarMonitor() {
    if (!db) return;
    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    
    store.getAll().onsuccess = (e) => {
        const registros = e.target.result;
        const total = registros.length;
        document.getElementById('contador-total').innerText = total;

        // Cálculos
        const associados = registros.filter(r => r.tipo === "ASSOCIADO").length;
        const adeptos = registros.filter(r => r.tipo === "ADEPTO").length;
        const autos = registros.filter(r => r.origem === "AUTO").length;
        const terceiros = registros.filter(r => r.origem === "TERCEIRO").length;

        // Atualiza Visuais
        document.getElementById('txt-associado').innerText = associados;
        document.getElementById('txt-adepto').innerText = adeptos;
        
        if (total > 0) {
            document.getElementById('bar-associado').style.width = (associados / total * 100) + "%";
            document.getElementById('bar-adepto').style.width = (adeptos / total * 100) + "%";
            document.getElementById('perc-auto').innerText = Math.round(autos/total*100) + "%";
            document.getElementById('perc-terceiro').innerText = Math.round(terceiros/total*100) + "%";
        }

        // Lista
        const listaDiv = document.getElementById('lista-cadastros');
        if (total === 0) {
            listaDiv.innerHTML = '<p style="text-align: center; color: #999;">Sem cadastros.</p>';
            return;
        }
        let html = '<table style="width:100%; font-size: 0.9em;">';
        [...registros].reverse().slice(0, 10).forEach(r => {
            html += `<tr style="border-bottom: 1px solid #eee; padding: 4px 0;"><td><strong>${r.nome}</strong><br><small>${r.bairro}</small></td></tr>`;
        });
        html += '</table>';
        listaDiv.innerHTML = html;
    };
}

// --- GESTÃO DE USUÁRIOS ---

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    if (!nome || !codigo) return alert("Preencha tudo!");

    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Cadastrado!");
        listarUsuarios();
    };
}

function alterarSenha() {
    const atual = document.getElementById('cod-atual').value.trim();
    const nova = document.getElementById('cod-novo').value.trim();
    if (!atual || !nova) return alert("Preencha os códigos!");

    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    store.get(atual).onsuccess = (e) => {
        const u = e.target.result;
        if (!u) return alert("Código atual não existe!");
        store.delete(atual).onsuccess = () => {
            store.add({ codigo: nova, nome: u.nome, perfil: u.perfil }).onsuccess = () => {
                alert("Senha alterada!");
                listarUsuarios();
            };
        };
    };
}

function listarUsuarios() {
    const tx = db.transaction("usuarios", "readonly");
    tx.objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = '<table>';
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome} (${u.perfil})</td><td><button onclick="excluirUsuario('${u.codigo}')" style="background:red; color:white; padding:2px 5px; font-size:10px;">X</button></td></tr>`;
        });
        document.getElementById('lista-usuarios').innerHTML = html + '</table>';
    };
}

function excluirUsuario(c) {
    if(confirm("Excluir?")) db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
}

// --- CORE ---

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        const r = baseLocal[cep];
        if (r) {
            document.getElementById('logradouro').value = r[0].logradouro;
            document.getElementById('bairro').value = r[0].bairro;
        }
    } catch (e) { console.log("Erro CEP local"); }
}

function salvar() {
    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value,
        nome: document.getElementById('nome').value.trim(),
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: document.getElementById('cpf').value,
        nascimento: document.getElementById('nascimento').value,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        data_cadastro: new Date().toLocaleString(),
        autor: document.getElementById('label-perfil').innerText
    };
    if (!registro.nome) return alert("Nome obrigatório!");
    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").add(registro).onsuccess = () => {
        alert("Salvo!");
        ["nome", "sobrenome", "cpf", "cep", "logradouro", "bairro", "numero"].forEach(id => document.getElementById(id).value = "");
        atualizarMonitor();
    };
}

function exportarDados() {
    const perfil = document.getElementById('label-perfil').innerText;
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        let dados = e.target.result;
        if (perfil !== "GESTOR") dados = dados.map(i => ({ ...i, cpf: "PROTEGIDO" }));
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cadastros_${perfil.toLowerCase()}.json`;
        a.click();
    };
}
