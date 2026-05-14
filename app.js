const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec";
let db;

// =====================================================================
// ABERTURA DO BANCO LOCAL
// =====================================================================
const request = indexedDB.open("JGUA_FINAL_DB", 22);

request.onerror = () => alert("Erro ao iniciar o banco de dados. Tente recarregar a página.");

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("usuarios")) {
        db.createObjectStore("usuarios", { keyPath: "codigo" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    // Ao abrir o app, primeiro sincroniza os usuários da nuvem,
    // depois libera o botão de login
    sincronizarUsuariosDaNuvem();
};

// =====================================================================
// SINCRONIZA USUÁRIOS DA NUVEM → salva localmente
// Chamado sempre que o app abre, em qualquer dispositivo
// =====================================================================
async function sincronizarUsuariosDaNuvem() {
    const btn = document.querySelector('button[onclick="autenticar()"]');
    if (btn) { btn.disabled = true; btn.innerText = "Carregando..."; }

    try {
        const res = await fetch(URL_PLANILHA + "?acao=listarUsuarios&t=" + Date.now());
        const usuarios = await res.json();

        if (Array.isArray(usuarios) && usuarios.length > 0) {
            const tx = db.transaction("usuarios", "readwrite");
            const store = tx.objectStore("usuarios");

            // Garante que o GESTOR MESTRE sempre existe
            const semestre = { codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" };
            store.put(semestre);

            usuarios.forEach(u => {
                if (u.codigo) store.put(u);
            });

            tx.oncomplete = () => {
                console.log("Usuários sincronizados da nuvem.");
                liberarLogin();
            };
        } else {
            // Nuvem vazia ou erro: garante pelo menos o usuário padrão local
            garantirUsuarioPadrao();
        }
    } catch (err) {
        console.warn("Sem conexão ou erro na nuvem. Usando banco local.", err);
        // Sem internet: usa o banco local (usuários já sincronizados antes)
        garantirUsuarioPadrao();
    }
}

// Garante o usuário padrão 1234 caso a nuvem não responda
function garantirUsuarioPadrao() {
    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    const check = store.get("1234");
    check.onsuccess = (e) => {
        if (!e.target.result) {
            store.put({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
        }
        liberarLogin();
    };
    check.onerror = () => liberarLogin();
}

function liberarLogin() {
    const btn = document.querySelector('button[onclick="autenticar()"]');
    if (btn) { btn.disabled = false; btn.innerText = "Acessar Sistema"; }
}

// =====================================================================
// SINCRONIZA CADASTROS DA NUVEM
// =====================================================================
async function sincronizarDadosDaNuvem() {
    try {
        const res = await fetch(URL_PLANILHA + "?t=" + Date.now());
        const registros = await res.json();
        if (!Array.isArray(registros)) return;

        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        store.clear();
        registros.forEach(reg => {
            const idReal = reg.Cadastrador_ID || reg.id;
            if (idReal) { reg.id = String(idReal); store.put(reg); }
        });
        tx.oncomplete = () => atualizarMonitor();
    } catch (e) {
        console.error("Erro ao sincronizar cadastros:", e);
    }
}

// =====================================================================
// AUTENTICAÇÃO
// =====================================================================
function autenticar() {
    const cod = document.getElementById('input-codigo').value.trim();
    if (!db) return alert("Banco ainda carregando. Aguarde e tente novamente.");
    if (!cod) return alert("Digite seu código de acesso.");

    db.transaction("usuarios", "readonly").objectStore("usuarios").get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');

            const monitor = document.getElementById('monitor');
            const secaoAdmin = document.getElementById('secao-admin-users');
            monitor.classList.add('hidden');
            secaoAdmin.classList.add('hidden');

            if (u.perfil === "GESTOR") {
                monitor.classList.remove('hidden');
                secaoAdmin.classList.remove('hidden');
            } else if (u.perfil !== "CADASTRADOR") {
                monitor.classList.remove('hidden');
            }

            sincronizarDadosDaNuvem();
            listarUsuarios();
        } else {
            alert("Código de acesso inválido!");
        }
    };
}

// =====================================================================
// SALVAR CADASTRO
// =====================================================================
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nomeComp = document.getElementById('nome_completo').value.trim();
    const cpfLimpo = document.getElementById('cpf').value.replace(/\D/g, '');
    if (!nomeComp || !cpfLimpo) return alert("Nome e CPF são obrigatórios!");

    if (!editId) {
        const existe = await verificarCPFDuplicado(document.getElementById('cpf').value);
        if (existe) return alert("ERRO: Este CPF já está cadastrado no sistema!");
    }

    const registro = {
        "Cadastrador_ID": editId || "CAD-" + Date.now(),
        "Status": "Ativo",
        "Perfil": document.getElementById('tipo').value,
        "Nome_Completo": nomeComp,
        "CPF": document.getElementById('cpf').value,
        "Sexo": document.getElementById('sexo').value,
        "Data_Nascimento": document.getElementById('nascimento').value,
        "WhatsApp": document.getElementById('whatsapp').value,
        "Email": document.getElementById('email').value,
        "CEP": document.getElementById('cep').value,
        "Bairro": document.getElementById('bairro').value,
        "Rua": document.getElementById('logradouro').value,
        "Numero": document.getElementById('numero').value,
        "Canal_Preferencial": document.getElementById('origem').value,
        "Atualizado_Por": document.getElementById('label-nome-user').innerText,
        "Atualizado_Em": new Date().toLocaleString()
    };

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        const registroLocal = { ...registro, id: String(registro.Cadastrador_ID) };
        tx.objectStore("cadastros").put(registroLocal);
        tx.oncomplete = () => { alert("Cadastro realizado com sucesso!"); location.reload(); };
    } catch (e) {
        alert("Erro ao conectar com a nuvem.");
    }
}

function verificarCPFDuplicado(cpf) {
    return new Promise((resolve) => {
        db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
            resolve(e.target.result.some(r => r.CPF === cpf));
        };
    });
}

// =====================================================================
// GESTÃO DE USUÁRIOS — salva na nuvem E localmente
// =====================================================================
function criarUsuario() {
    const nome   = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    if (!nome || !codigo) return alert("Preencha o nome e o código.");

    const usuario = { codigo, nome, perfil };

    // 1. Salva na nuvem (Google Sheets)
    fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ acao: "salvarUsuario", ...usuario })
    });

    // 2. Salva no banco local também
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").put(usuario);
    tx.oncomplete = () => {
        alert(`Acesso criado para ${nome}!\n\nO código "${codigo}" já pode ser usado em qualquer celular.`);
        document.getElementById('novo-nome').value = '';
        document.getElementById('novo-codigo').value = '';
        listarUsuarios();
    };
}

function excluirUsuario(codigo) {
    if (!confirm("Excluir este acesso?")) return;

    // 1. Remove da nuvem
    fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ acao: "excluirUsuario", codigo })
    });

    // 2. Remove do banco local
    db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(codigo).onsuccess = () => listarUsuarios();
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    if (!listaDiv) return;
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        const usuarios = e.target.result;
        if (usuarios.length === 0) {
            listaDiv.innerHTML = "<p style='color:#999; font-size:0.9em;'>Nenhum integrante cadastrado.</p>";
            return;
        }
        let html = `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9em;">
            <tr style="background:#f0f0f0;">
                <th style="padding:8px; text-align:left;">Nome</th>
                <th style="padding:8px; text-align:left;">Perfil</th>
                <th style="padding:8px; text-align:left;">Código</th>
                <th style="padding:8px;"></th>
            </tr>`;
        usuarios.forEach(u => {
            const ehMestre = u.codigo === '1234';
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px;">${u.nome}</td>
                <td style="padding:8px;"><span style="background:#e3f2fd; color:#1565c0; padding:2px 8px; border-radius:10px; font-size:0.85em;">${u.perfil}</span></td>
                <td style="padding:8px; font-family:monospace; font-weight:bold;">${u.codigo}</td>
                <td style="padding:8px;">${ehMestre ? '' : `<button onclick="excluirUsuario('${u.codigo}')" style="background:#dc3545; color:white; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:0.85em;">Excluir</button>`}</td>
            </tr>`;
        });
        html += "</table>";
        listaDiv.innerHTML = html;
    };
}

// =====================================================================
// MONITOR / BUSCA
// =====================================================================
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca')?.value.toLowerCase() || "";
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        let somaIdades = 0, contagemComData = 0;
        const hoje = new Date();
        const filtrados = registros.filter(r =>
            (r.Nome_Completo || "").toLowerCase().includes(termo) ||
            (r.CPF || "").includes(termo) ||
            (r.Bairro || "").toLowerCase().includes(termo)
        );
        document.getElementById('contador-total').innerText = filtrados.length;
        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            let vNasc = "---";
            if (r.Data_Nascimento) {
                vNasc = new Date(r.Data_Nascimento).toISOString().split('T')[0];
                let idade = hoje.getFullYear() - new Date(r.Data_Nascimento).getFullYear();
                if (idade >= 0 && idade < 120) { somaIdades += idade; contagemComData++; }
            }
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')">
                <strong>${r.Nome_Completo || "Sem Nome"}</strong> — ${r.Bairro || "---"}<br>
                <small>CPF: ${r.CPF || "---"} | Nasc: ${vNasc}</small></div>`;
        });
        document.getElementById('media-idade').innerText = contagemComData > 0 ? Math.round(somaIdades / contagemComData) : 0;
        document.getElementById('lista-cadastros').innerHTML = html || "<p style='color:#999;'>Nenhum registro encontrado.</p>";
    };
}

// =====================================================================
// EDIÇÃO DE CADASTRO
// =====================================================================
function prepararEdicao(idOriginal) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(String(idOriginal)).onsuccess = (e) => {
        const r = e.target.result;
        if (!r) return;
        let s = r.Sexo || "";
        if (s === "M") s = "Masculino";
        if (s === "F") s = "Feminino";
        document.getElementById('tipo').value = r.Perfil || "ASSOCIADO";
        document.getElementById('origem').value = r.Canal_Preferencial || "EQUIPE";
        document.getElementById('nome_completo').value = r.Nome_Completo || "";
        document.getElementById('cpf').value = r.CPF || "";
        document.getElementById('sexo').value = s;
        document.getElementById('nascimento').value = r.Data_Nascimento ? new Date(r.Data_Nascimento).toISOString().split('T')[0] : "";
        document.getElementById('whatsapp').value = r.WhatsApp || "";
        document.getElementById('email').value = r.Email || "";
        document.getElementById('cep').value = r.CEP || "";
        document.getElementById('bairro').value = r.Bairro || "";
        document.getElementById('logradouro').value = r.Rua || "";
        document.getElementById('numero').value = r.Numero || "";
        document.getElementById('edit-id').value = r.id;
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() { location.reload(); }

// =====================================================================
// BUSCA DE CEP
// =====================================================================
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await res.json();
            if (!d.erro) {
                document.getElementById('logradouro').value = d.logradouro || "";
                document.getElementById('bairro').value = d.bairro || "";
            }
        } catch (e) { console.error("Erro ao buscar CEP:", e); }
    }
}

// =====================================================================
// EXPORTAR DADOS
// =====================================================================
function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "jgua_export_" + new Date().toISOString().split('T')[0] + ".json";
        a.click();
    };
}
