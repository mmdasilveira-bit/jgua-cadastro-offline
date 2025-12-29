const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec";
let db;

const request = indexedDB.open("JGUA_FINAL_DB", 20);

request.onsuccess = (e) => {
    db = e.target.result;
    console.log("Banco pronto no Chrome.");
    const btn = document.querySelector('button[onclick="autenticar()"]');
    if (btn) {
        btn.disabled = false;
        btn.innerText = "Acessar Sistema";
    }
};

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) db.createObjectStore("cadastros", { keyPath: "id" });
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

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
    } catch (e) { console.error("Erro na nuvem:", e); }
}

function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    if (!db) return alert("Banco carregando...");

    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    
    store.get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            // Identificação do Usuário
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            
            // Troca de tela: Login -> Sistema
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            
            // --- CONTROLE DE VISIBILIDADE POR PERFIL ---
            const monitor = document.getElementById('monitor');
            const secaoAdmin = document.getElementById('secao-admin-users');

            // 1. GESTOR: Vê absolutamente tudo
            if (u.perfil === "GESTOR") {
                monitor?.classList.remove('hidden');
                secaoAdmin?.classList.remove('hidden');
            } 
            // 2. CADASTRADOR: Vê apenas o formulário (esconde o monitor e admin)
            else if (u.perfil === "CADASTRADOR") {
                monitor?.classList.add('hidden');
                secaoAdmin?.classList.add('hidden');
            }
            // 3. OUTROS (AVALIADOR, COORDENADOR, VALIDADOR): Vê formulário e monitor
            else {
                monitor?.classList.remove('hidden');
                secaoAdmin?.classList.add('hidden');
            }

            sincronizarDadosDaNuvem(); 
            listarUsuarios();
        } else { 
            alert("Código de acesso inválido!"); 
        }
    };
    // Garante que as seções fiquem escondidas por padrão antes da lógica de perfil rodar
document.getElementById('monitor').classList.add('hidden');
document.getElementById('secao-admin-users').classList.add('hidden');
}

async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nomeComp = document.getElementById('nome_completo').value.trim();
    const cpfLimpo = document.getElementById('cpf').value.replace(/\D/g, ''); // Remove pontos e traços para comparar

    if (!nomeComp || !cpfLimpo) return alert("Nome e CPF são obrigatórios!");

    // --- NOVA TRAVA DE DUPLICIDADE ---
    // Se não for uma edição de um cadastro existente, verifica se o CPF já existe
    if (!editId) {
        const existe = await verificarCPFDuplicado(document.getElementById('cpf').value);
        if (existe) {
            alert("ERRO: Este CPF já está cadastrado no sistema!");
            return; // Interrompe o salvamento
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
        const registroLocal = {...registro, id: String(registro.Cadastrador_ID)};
        tx.objectStore("cadastros").put(registroLocal);
        tx.oncomplete = () => {
            alert("Cadastro realizado com sucesso!");
            location.reload(); 
        };
    } catch (e) { alert("Erro ao conectar com a nuvem."); }
}

// Função auxiliar para buscar o CPF no banco local
function verificarCPFDuplicado(cpfParaChecar) {
    return new Promise((resolve) => {
        const tx = db.transaction("cadastros", "readonly");
        const store = tx.objectStore("cadastros");
        const request = store.getAll();

        request.onsuccess = (e) => {
            const todos = e.target.result;
            const duplicado = todos.some(r => r.CPF === cpfParaChecar);
            resolve(duplicado);
        };
    });
}

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

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").put({ codigo, nome, perfil });
    tx.oncomplete = () => { alert("Acesso Criado!"); listarUsuarios(); };
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

function excluirU(c) {
    if(confirm("Excluir?")) {
        db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
    }
}

function cancelarEdicao() { location.reload(); }

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
            if(!d.erro) {
                document.getElementById('logradouro').value = d.logradouro || "";
                document.getElementById('bairro').value = d.bairro || "";
            }
        });
    }
}
