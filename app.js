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

request.onsuccess = (e) => { db = e.target.result; };

// --- MONITOR COM FILTRO DE BUSCA ---

function atualizarMonitor() {
    if (!db) return;
    const termoBusca = document.getElementById('input-busca').value.toLowerCase();
    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    
    store.getAll().onsuccess = (e) => {
        const registros = e.target.result;
        const total = registros.length;
        document.getElementById('contador-total').innerText = total;

        // Estatísticas (sempre sobre o total)
        const associados = registros.filter(r => r.tipo === "ASSOCIADO").length;
        const adeptos = registros.filter(r => r.tipo === "ADEPTO").length;
        document.getElementById('txt-associado').innerText = associados;
        document.getElementById('txt-adepto').innerText = adeptos;
        
        if (total > 0) {
            document.getElementById('bar-associado').style.width = (associados / total * 100) + "%";
            document.getElementById('bar-adepto').style.width = (adeptos / total * 100) + "%";
            
            let autos = registros.filter(r => r.origem === "AUTO").length;
            document.getElementById('perc-auto').innerText = Math.round(autos/total*100) + "%";
            document.getElementById('perc-terceiro').innerText = Math.round((total-autos)/total*100) + "%";
        }

        // Lógica de Filtragem
        const filtrados = registros.filter(r => {
            return r.nome.toLowerCase().includes(termoBusca) || 
                   r.cpf.includes(termoBusca) || 
                   r.bairro.toLowerCase().includes(termoBusca) ||
                   (r.sobrenome && r.sobrenome.toLowerCase().includes(termoBusca));
        });

        // Renderização da Lista
        const listaDiv = document.getElementById('lista-cadastros');
        if (filtrados.length === 0) {
            listaDiv.innerHTML = '<p style="text-align: center; color: #999;">Nenhum resultado encontrado.</p>';
            return;
        }

        let html = '<table style="width:100%; border-collapse: collapse;">';
        [...filtrados].reverse().forEach(r => {
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0;">
                    <strong>${r.nome} ${r.sobrenome || ''}</strong><br>
                    <small>${r.bairro} | CPF: ${r.cpf}</small>
                </td>
            </tr>`;
        });
        listaDiv.innerHTML = html + '</table>';
    };
}

// --- GESTÃO DE EQUIPE ---

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
    if (!atual || !nova) return alert("Preencha os campos!");
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
        let html = '<table style="width:100%">';
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome}</td><td><button onclick="excluirUsuario('${u.codigo}')" style="background:red; color:white; padding:2px 5px;">X</button></td></tr>`;
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
        data_cadastro: new Date().toLocaleString()
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
        a.download = `cadastros.json`;
        a.click();
    };
}
