const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
const request = indexedDB.open("JGUA_FINAL_DB", 20); // Mantendo a versão 20 que funcionou no Firefox

// Localiza o botão de login para controle de estado
const btnAcessar = document.querySelector('button[onclick="autenticar()"]');
if (btnAcessar) {
    btnAcessar.disabled = true;
    btnAcessar.innerText = "Carregando Banco...";
}

request.onsuccess = (e) => { 
    db = e.target.result; 
    console.log("Banco JGUA_FINAL_DB pronto.");
    
    // Libera o botão apenas quando o banco está disponível
    if (btnAcessar) {
        btnAcessar.disabled = false;
        btnAcessar.innerText = "Acessar Sistema";
    }
    
    sincronizarDadosDaNuvem();
};

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) db.createObjectStore("cadastros", { keyPath: "id" });
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};


function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    
    // CORREÇÃO PARA O CHROME: Verifica se o banco já abriu
    if (!db) {
        console.log("Aguardando banco de dados...");
        alert("O sistema ainda está carregando os dados. Aguarde 3 segundos e tente novamente.");
        return;
    }

    try {
        const tx = db.transaction("usuarios", "readonly");
        const store = tx.objectStore("usuarios");
        const consulta = store.get(cod);

        consulta.onsuccess = () => {
            const u = consulta.result;
            if (u) {
                document.getElementById('label-perfil').innerText = u.perfil;
                document.getElementById('label-nome-user').innerText = u.nome;
                document.getElementById('secao-login').classList.add('hidden');
                document.getElementById('conteudo').classList.remove('hidden');
                
                // Requisitos de visibilidade mantidos
                if(u.perfil === "CADASTRADOR") {
                    document.getElementById('monitor').classList.add('hidden');
                }
                if(u.perfil === "GESTOR") {
                    document.getElementById('secao-admin-users')?.classList.remove('hidden');
                }
                
                atualizarMonitor();
                listarUsuarios();
            } else { 
                alert("Código inválido!"); 
            }
        };
    } catch (e) {
        console.error("Erro ao acessar banco:", e);
        alert("Erro técnico: O banco de dados não respondeu. Recarregue a página (F5).");
    }
}


async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value;
    const userAtual = document.getElementById('label-nome-user').innerText;

    if (!nome || !cpf) return alert("Campos obrigatórios!");

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        nome: nome,
        sobrenome: document.getElementById('sobrenome')?.value || "",
        cpf: cpf,
        whatsapp: document.getElementById('whatsapp').value,
        bairro: document.getElementById('bairro').value,
        origem: document.getElementById('origem').value,
        atualizado_por: userAtual,
        atualizado_em: new Date().toLocaleString()
    };

    if (!editId) {
        registro.criado_por = userAtual;
        registro.criado_em = new Date().toLocaleString();
    }

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        tx.objectStore("cadastros").put(registro);
        tx.oncomplete = () => {
            alert("Salvo!");
            location.reload(); 
        };
    } catch (e) { alert("Erro ao salvar."); }
}

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").put({ codigo, nome, perfil });
    tx.oncomplete = () => {
        alert("Acesso Criado!");
        listarUsuarios();
    };
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    if(!listaDiv) return;
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = "<table>";
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome} (${u.perfil})</td>
            <td>${u.codigo !== '1234' ? `<button onclick="excluirU('${u.codigo}')">X</button>` : ''}</td></tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };
}

function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        let html = "";
        registros.reverse().slice(0, 20).forEach(r => {
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')">
                <strong>${r.nome}</strong> - ${r.bairro || '---'}<br>
                <small>CPF: ${r.cpf}</small></div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Vazio.";
    };
}

function excluirU(c) {
    if(confirm("Excluir?")) db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
}

function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        document.getElementById('edit-id').value = r.id;
        const campos = ["nome", "sobrenome", "cpf", "whatsapp", "bairro", "tipo", "origem"];
        campos.forEach(c => { if(document.getElementById(c)) document.getElementById(c).value = r[c] || ""; });
        document.getElementById('titulo-form').innerText = "Editar";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
    };
}

function cancelarEdicao() { location.reload(); }
