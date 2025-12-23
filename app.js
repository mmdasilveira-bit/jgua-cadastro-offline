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

// GESTÃO DE EQUIPE
function criarUsuario() {
    const perfilLogado = document.getElementById('label-perfil').innerText;
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfilNovo = document.getElementById('novo-perfil').value;

    if (!nome || !codigo) return alert("Preencha todos os campos!");
    if (perfilLogado === "COORDENADOR" && (perfilNovo === "GESTOR" || perfilNovo === "COORDENADOR")) {
        return alert("Você não tem permissão para criar este perfil.");
    }

    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    const pedido = store.add({ codigo, nome, perfil: perfilNovo });

    pedido.onsuccess = () => {
        alert("Integrante cadastrado!");
        document.getElementById('novo-nome').value = "";
        document.getElementById('novo-codigo').value = "";
        listarUsuarios();
    };
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    
    store.getAll().onsuccess = (e) => {
        const usuarios = e.target.result;
        let html = '<table style="width:100%; border-collapse: collapse;">';
        usuarios.forEach(u => {
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0;"><strong>${u.nome}</strong> (${u.perfil})</td>
                <td style="text-align: right;">
                    <button onclick="excluirUsuario('${u.codigo}')" style="width: auto; padding: 5px 10px; background: #dc3545; color: white; margin: 0; font-size: 0.7em;">Excluir</button>
                </td>
            </tr>`;
        });
        html += '</table>';
        listaDiv.innerHTML = html;
    };
}

function excluirUsuario(codigo) {
    if (!confirm("Excluir este acesso?")) return;
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").delete(codigo).onsuccess = () => {
        alert("Removido!");
        listarUsuarios();
    };
}

// BUSCA DE CEP
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, ''); 
    if (cep.length !== 8) return;
    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        const resultado = baseLocal[cep]; 
        if (resultado && resultado.length > 0) {
            const dados = resultado[0];
            document.getElementById('logradouro').value = dados.logradouro || '';
            document.getElementById('bairro').value = dados.bairro || '';
        } else if (navigator.onLine) {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await res.json();
            if (!d.erro) {
                document.getElementById('logradouro').value = d.logradouro;
                document.getElementById('bairro').value = d.bairro;
            }
        }
    } catch (e) { console.error(e); }
}

// CADASTRO E EXPORTAÇÃO
function salvar() {
    const perfil = document.getElementById('label-perfil').innerText;
    const registro = {
        nome: document.getElementById('nome').value,
        sobrenome: document.getElementById('sobrenome').value,
        cpf: document.getElementById('cpf').value,
        data: new Date().toLocaleString(),
        autor: perfil
    };
    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").add(registro).onsuccess = () => {
        alert("Salvo!");
        ["nome", "sobrenome", "cpf", "cep", "logradouro", "bairro", "numero"].forEach(id => document.getElementById(id).value = "");
    };
}

function exportarDados() {
    const perfil = document.getElementById('label-perfil').innerText;
    const tx = db.transaction("cadastros", "readonly");
    tx.objectStore("cadastros").getAll().onsuccess = (e) => {
        let dados = e.target.result;
        if (perfil !== "GESTOR") {
            dados = dados.map(item => ({ ...item, cpf: "PROTEGIDO" }));
        }
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cadastros_${perfil.toLowerCase()}.json`;
        a.click();
    };
}
