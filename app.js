const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec";
let db;
let usuarioLogado = null; // guarda o usuário da sessão atual

// =====================================================================
// ABERTURA DO BANCO LOCAL
// =====================================================================
const request = indexedDB.open("JGUA_FINAL_DB", 23);

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
    sincronizarUsuariosDaNuvem();
};

// =====================================================================
// SINCRONIZA USUÁRIOS DA NUVEM → salva localmente
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
            store.clear();
            usuarios.forEach(u => { if (u.codigo) store.put(u); });
            tx.oncomplete = () => {
                // Garante que o GESTOR MESTRE sempre existe localmente
                garantirUsuarioPadrao();
            };
        } else {
            garantirUsuarioPadrao();
        }
    } catch (err) {
        console.warn("Sem conexão. Usando banco local.", err);
        garantirUsuarioPadrao();
    }
}

function garantirUsuarioPadrao() {
    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    const check = store.get("1234");
    check.onsuccess = (e) => {
        if (!e.target.result) {
            store.put({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR", email: "" });
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
            usuarioLogado = u;
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
// MODAL — ALTERAR CÓDIGO (o próprio usuário troca o seu)
// =====================================================================
function abrirModalAlterarCodigo() {
    document.getElementById('alt-codigo-atual').value = '';
    document.getElementById('alt-codigo-novo').value = '';
    document.getElementById('alt-codigo-confirma').value = '';
    document.getElementById('modal-alterar').classList.remove('hidden');
}

function confirmarAlterarCodigo() {
    const atual    = document.getElementById('alt-codigo-atual').value.trim();
    const novo     = document.getElementById('alt-codigo-novo').value.trim();
    const confirma = document.getElementById('alt-codigo-confirma').value.trim();

    if (!atual || !novo || !confirma) return alert("Preencha todos os campos.");
    if (atual !== usuarioLogado.codigo) return alert("Código atual incorreto.");
    if (novo.length < 4) return alert("O novo código deve ter pelo menos 4 caracteres.");
    if (novo !== confirma) return alert("O novo código e a confirmação não coincidem.");

    // Monta o objeto atualizado (mantém todos os dados, só troca o código)
    const usuarioAtualizado = { ...usuarioLogado, codigo: novo };

    // 1. Remove o registro antigo (chave mudou) e insere o novo localmente
    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    store.delete(usuarioLogado.codigo);
    store.put(usuarioAtualizado);

    tx.oncomplete = () => {
        // 2. Envia para a nuvem: exclui o antigo e salva o novo
        fetch(URL_PLANILHA, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ acao: "excluirUsuario", codigo: usuarioLogado.codigo })
        });
        fetch(URL_PLANILHA, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ acao: "salvarUsuario", ...usuarioAtualizado })
        });

        alert(`Código alterado com sucesso!\n\nSeu novo código é: ${novo}\n\nGuarde em local seguro.`);
        usuarioLogado = usuarioAtualizado;
        document.getElementById('modal-alterar').classList.add('hidden');
    };
}

// =====================================================================
// MODAL — ESQUECI MEU CÓDIGO (busca por e-mail)
// =====================================================================
function abrirModalEsqueci() {
    document.getElementById('esqueci-email').value = '';
    document.getElementById('esqueci-resultado').innerHTML = '';
    document.getElementById('modal-esqueci').classList.remove('hidden');
}

function buscarPorEmail() {
    const emailDigitado = document.getElementById('esqueci-email').value.trim().toLowerCase();
    const resultado = document.getElementById('esqueci-resultado');

    if (!emailDigitado) return alert("Digite seu e-mail.");

    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        const usuarios = e.target.result;
        const encontrado = usuarios.find(u =>
            u.email && u.email.trim().toLowerCase() === emailDigitado
        );

        if (encontrado) {
            resultado.innerHTML = `
                <div style="background:#e8f5e9; border:1px solid #a5d6a7; border-radius:8px; padding:15px; text-align:center;">
                    <p style="margin:0 0 6px; font-size:0.9em; color:#555;">Olá, <strong>${encontrado.nome}</strong>! Seu código é:</p>
                    <p style="font-size:2em; font-weight:bold; letter-spacing:4px; color:#1b5e20; margin:0;">${encontrado.codigo}</p>
                </div>`;
        } else {
            resultado.innerHTML = `
                <div style="background:#fff3e0; border:1px solid #ffcc80; border-radius:8px; padding:12px; text-align:center; font-size:0.9em; color:#e65100;">
                    E-mail não encontrado. Verifique o endereço ou entre em contato com o Gestor.
                </div>`;
        }
    };
}

// =====================================================================
// GESTÃO DE USUÁRIOS
// =====================================================================
function criarUsuario() {
    const nome   = document.getElementById('novo-nome').value.trim();
    const email  = document.getElementById('novo-email').value.trim().toLowerCase();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;

    if (!nome || !codigo) return alert("Preencha pelo menos o nome e o código.");
    if (codigo.length < 4) return alert("O código deve ter pelo menos 4 caracteres.");

    const usuario = { codigo, nome, perfil, email };

    // Salva na nuvem
    fetch(URL_PLANILHA, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ acao: "salvarUsuario", ...usuario })
    });

    // Salva localmente
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").put(usuario);
    tx.oncomplete = () => {
        alert(`Acesso criado para ${nome}!\n\nCódigo: ${codigo}\n\nEle já pode entrar em qualquer dispositivo.`);
        document.getElementById('novo-nome').value = '';
        document.getElementById('novo-email').value = '';
        document.getElementById('novo-codigo').value = '';
        listarUsuarios();
    };
}

function excluirUsuario(codigo) {
    if (!confirm("Excluir este acesso?")) return;

    fetch(URL_PLANILHA, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ acao: "excluirUsuario", codigo })
    });

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
        let html = `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.85em;">
            <tr style="background:#f0f0f0;">
                <th style="padding:8px; text-align:left;">Nome</th>
                <th style="padding:8px; text-align:left;">Perfil</th>
                <th style="padding:8px; text-align:left;">Código</th>
                <th style="padding:8px;"></th>
            </tr>`;
        usuarios.forEach(u => {
            const ehMestre = u.codigo === '1234';
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px;">${u.nome}${u.email ? `<br><small style="color:#999;">${u.email}</small>` : ''}</td>
                <td style="padding:8px;"><span style="background:#e3f2fd; color:#1565c0; padding:2px 8px; border-radius:10px; font-size:0.8em;">${u.perfil}</span></td>
                <td style="padding:8px; font-family:monospace; font-weight:bold;">${u.codigo}</td>
                <td style="padding:8px;">${ehMestre ? '' : `<button onclick="excluirUsuario('${u.codigo}')" style="background:#dc3545;color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.8em;">Excluir</button>`}</td>
            </tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };
}

// =====================================================================
// SALVAR CADASTRO
// =====================================================================
async function salvar() {
    const editId   = document.getElementById('edit-id').value;
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
        "Atualizado_Por": usuarioLogado ? usuarioLogado.nome : "SISTEMA",
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
