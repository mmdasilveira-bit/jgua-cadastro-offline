let db;
const request = indexedDB.open("JGUA_DB", 2);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    // Tabela de Cadastros de Pessoas
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
    // Tabela de Usuários do Sistema (Equipe)
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    // Se o usuário já estiver logado (pós-refresh), atualiza o contador e lista
    if(!document.getElementById('conteudo').classList.contains('hidden')) {
        atualizarMonitor();
    }
};

// --- GESTÃO DE EQUIPE (ADMINISTRAÇÃO) ---

function criarUsuario() {
    const perfilLogado = document.getElementById('label-perfil').innerText;
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfilNovo = document.getElementById('novo-perfil').value;

    if (!nome || !codigo) return alert("Preencha todos os campos do novo integrante!");
    if (perfilLogado === "COORDENADOR" && (perfilNovo === "GESTOR" || perfilNovo === "COORDENADOR")) {
        return alert("Você não tem permissão para criar este perfil.");
    }

    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    const pedido = store.add({ codigo, nome, perfil: perfilNovo });

    pedido.onsuccess = () => {
        alert("Integrante cadastrado com sucesso!");
        document.getElementById('novo-nome').value = "";
        document.getElementById('novo-codigo').value = "";
        listarUsuarios();
    };
    pedido.onerror = () => alert("Erro: Este código já existe.");
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
                    <button onclick="excluirUsuario('${u.codigo}')" style="width: auto; padding: 5px 10px; background: #dc3545; color: white; margin: 0; font-size: 0.7em; cursor: pointer;">Excluir</button>
                </td>
            </tr>`;
        });
        html += '</table>';
        listaDiv.innerHTML = html;
    };
}

function excluirUsuario(codigo) {
    if (!confirm("Tem certeza que deseja excluir este acesso?")) return;
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").delete(codigo).onsuccess = () => {
        alert("Acesso removido!");
        listarUsuarios();
    };
}

// --- MONITORAMENTO DE CADASTROS (CONTADOR E LISTA) ---

function atualizarMonitor() {
    const listaDiv = document.getElementById('lista-cadastros');
    const contador = document.getElementById('contador-total');
    
    if (!db) return;

    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    
    store.getAll().onsuccess = (e) => {
        const registros = e.target.result;
        contador.innerText = registros.length;

        if (registros.length === 0) {
            listaDiv.innerHTML = '<p style="color: #999; text-align: center;">Nenhum cadastro realizado ainda.</p>';
            return;
        }

        let html = '<table style="width: 100%; border-collapse: collapse;">';
        // Inverte a lista para mostrar os mais recentes no topo
        registros.reverse().forEach(r => {
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px 0;">
                        <strong>${r.nome} ${r.sobrenome || ''}</strong><br>
                        <small style="color: #666;">${r.bairro} - ${r.data_cadastro}</small>
                    </td>
                </tr>`;
        });
        html += '</table>';
        listaDiv.innerHTML = html;
    };
}

// --- FUNCIONALIDADES DO FORMULÁRIO (CEP E SALVAR) ---

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
    } catch (e) { console.error("Erro ao buscar CEP:", e); }
}

function salvar() {
    const perfil = document.getElementById('label-perfil').innerText;
    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value,
        nome: document.getElementById('nome').value.trim(),
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: document.getElementById('cpf').value,
        nascimento: document.getElementById('nascimento').value,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        instagram: document.getElementById('instagram').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        data_cadastro: new Date().toLocaleString(),
        cadastrado_por: perfil
    };

    if (!registro.nome) return alert("O campo Nome é obrigatório!");

    const tx = db.transaction("cadastros", "readwrite");
    const store = tx.objectStore("cadastros");
    
    store.add(registro).onsuccess = () => {
        alert("Cadastro salvo com sucesso!");
        // Limpa os campos do formulário
        ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "instagram", "cep", "logradouro", "bairro", "numero"].forEach(id => {
            document.getElementById(id).value = "";
        });
        atualizarMonitor(); // Atualiza a lista e o contador imediatamente
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
        a.download = `cadastros_${perfil.toLowerCase()}_${new Date().toLocaleDateString()}.json`;
        a.click();
    };
}
