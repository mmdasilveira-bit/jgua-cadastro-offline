const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec";
let db;

// =====================================================================
// ABERTURA DO BANCO - Compatível com Chrome, Safari, Firefox e Edge
// =====================================================================
const request = indexedDB.open("JGUA_FINAL_DB", 21); // versão 21 para forçar upgrade em todos os dispositivos

request.onerror = (e) => {
    console.error("Erro ao abrir banco:", e);
    alert("Erro ao iniciar o banco de dados. Tente recarregar a página.");
};

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    console.log("Banco pronto.");

    // CORREÇÃO PRINCIPAL: Garante que o usuário padrão 1234 existe
    // em QUALQUER dispositivo (iPhone, Android, PC novo, etc.)
    garantirUsuarioPadrao();
};

// =====================================================================
// GARANTE QUE O USUÁRIO 1234 EXISTE EM QUALQUER DISPOSITIVO
// =====================================================================
function garantirUsuarioPadrao() {
    try {
        const tx = db.transaction("usuarios", "readwrite");
        const store = tx.objectStore("usuarios");
        const check = store.get("1234");

        check.onsuccess = (e) => {
            if (!e.target.result) {
                // Usuário não existe neste dispositivo — cria agora
                store.put({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
                console.log("Usuário padrão criado neste dispositivo.");
            }
            // Libera o botão de acesso
            habilitarBotaoLogin();
        };

        check.onerror = () => {
            // Mesmo se der erro na verificação, libera o botão
            habilitarBotaoLogin();
        };

    } catch (err) {
        console.error("Erro ao garantir usuário padrão:", err);
        habilitarBotaoLogin();
    }
}

function habilitarBotaoLogin() {
    const btn = document.querySelector('button[onclick="autenticar()"]');
    if (btn) {
        btn.disabled = false;
        btn.innerText = "Acessar Sistema";
    }
}

// =====================================================================
// SINCRONIZAR DADOS DA NUVEM
// =====================================================================
async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA + "?t=" + new Date().getTime());
        const registrosNuvem = await response.json();
        if (!registrosNuvem) return;

        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        store.clear();

        registrosNuvem.forEach(reg => {
            const idReal = reg.Cadastrador_ID || reg.id;
            if (idReal) {
                reg.id = String(idReal);
                store.put(reg);
            }
        });
        tx.oncomplete = () => atualizarMonitor();
    } catch (e) {
        console.error("Erro ao sincronizar com a nuvem:", e);
    }
}

// =====================================================================
// AUTENTICAÇÃO
// =====================================================================
function autenticar() {
    const cod = document.getElementById('input-codigo').value.trim();
    if (!db) return alert("Banco de dados ainda carregando. Aguarde um momento e tente novamente.");
    if (!cod) return alert("Digite seu código de acesso.");

    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");

    store.get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;

            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');

            const monitor = document.getElementById('monitor');
            const secaoAdmin = document.getElementById('secao-admin-users');

            // Esconde tudo primeiro
            monitor.classList.add('hidden');
            secaoAdmin.classList.add('hidden');

            // Libera conforme o perfil
            if (u.perfil === "GESTOR") {
                monitor.classList.remove('hidden');
                secaoAdmin.classList.remove('hidden');
            } else if (u.perfil === "CADASTRADOR") {
                // Só vê o formulário — monitor e admin ficam escondidos
            } else {
                // VALIDADOR, COORDENADOR, etc. — vê formulário e monitor
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
        if (existe) {
            alert("ERRO: Este CPF já está cadastrado no sistema!");
            return;
        }
    }

    const registro = {
        "Cadastrador_ID": editId || "CAD-" + new Date().getTime(),
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
        tx.oncomplete = () => {
            alert("Cadastro realizado com sucesso!");
            location.reload();
        };
    } catch (e) {
        alert("Erro ao conectar com a nuvem.");
    }
}

// =====================================================================
// VERIFICAR CPF DUPLICADO
// =====================================================================
function verificarCPFDuplicado(cpfParaChecar) {
    return new Promise((resolve) => {
        const tx = db.transaction("cadastros", "readonly");
        const store = tx.objectStore("cadastros");
        const req = store.getAll();
        req.onsuccess = (e) => {
            const todos = e.target.result;
            const duplicado = todos.some(r => r.CPF === cpfParaChecar);
            resolve(duplicado);
        };
        req.onerror = () => resolve(false);
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
        let somaIdades = 0;
        let contagemComData = 0;
        const hoje = new Date();
        let html = "";

        const filtrados = registros.filter(r =>
            (r.Nome_Completo || "").toLowerCase().includes(termo) ||
            (r.CPF || "").includes(termo) ||
            (r.Bairro || "").toLowerCase().includes(termo)
        );

        document.getElementById('contador-total').innerText = filtrados.length;

        filtrados.reverse().slice(0, 20).forEach(r => {
            let vNasc = "---";
            if (r.Data_Nascimento) {
                vNasc = new Date(r.Data_Nascimento).toISOString().split('T')[0];
                let idade = hoje.getFullYear() - new Date(r.Data_Nascimento).getFullYear();
                if (idade >= 0 && idade < 120) { somaIdades += idade; contagemComData++; }
            }
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')" style="border-bottom:1px solid #eee; padding:10px; cursor:pointer;">
                <strong>${r.Nome_Completo || "Sem Nome"}</strong> - ${r.Bairro || "---"}<br>
                <small>CPF: ${r.CPF || "---"} | Nasc: ${vNasc}</small></div>`;
        });

        document.getElementById('media-idade').innerText = contagemComData > 0 ? Math.round(somaIdades / contagemComData) : 0;
        document.getElementById('lista-cadastros').innerHTML = html || "Vazio.";
    };
}

// =====================================================================
// EDIÇÃO DE CADASTRO
// =====================================================================
function prepararEdicao(idOriginal) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(String(idOriginal)).onsuccess = (e) => {
        const r = e.target.result;
        if (!r) return;

        let dataLimpa = r.Data_Nascimento ? new Date(r.Data_Nascimento).toISOString().split('T')[0] : "";
        let s = r.Sexo || "";
        if (s === "M") s = "Masculino";
        if (s === "F") s = "Feminino";

        document.getElementById('tipo').value = r.Perfil || "ASSOCIADO";
        document.getElementById('origem').value = r.Canal_Preferencial || "EQUIPE";
        document.getElementById('nome_completo').value = r.Nome_Completo || "";
        document.getElementById('cpf').value = r.CPF || "";
        document.getElementById('sexo').value = s;
        document.getElementById('nascimento').value = dataLimpa;
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

// =====================================================================
// GESTÃO DE USUÁRIOS
// =====================================================================
function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    if (!nome || !codigo) return alert("Preencha o nome e o código.");
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").put({ codigo, nome, perfil });
    tx.oncomplete = () => { alert("Acesso Criado!"); listarUsuarios(); };
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    if (!listaDiv) return;
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = "<table>";
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome} (${u.perfil})</td>
            <td>${u.codigo !== '1234' ? `<button onclick="excluirU('${u.codigo}')">X</button>` : ''}</td></tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };
}

function excluirU(c) {
    if (confirm("Excluir este acesso?")) {
        db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
    }
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
        } catch (e) {
            console.error("Erro ao buscar CEP:", e);
        }
    }
}

// =====================================================================
// EXPORTAR DADOS
// =====================================================================
function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const dados = e.target.result;
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "jgua_export_" + new Date().toISOString().split('T')[0] + ".json";
        a.click();
        URL.revokeObjectURL(url);
    };
}
