//indexedDB.deleteDatabase("JGUA_DB");
//https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Mantemos a versão 10 que funcionou para o seu Linux
const request = indexedDB.open("JGUA_DB", 10);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (db.objectStoreNames.contains("cadastros")) db.deleteObjectStore("cadastros");
    if (db.objectStoreNames.contains("usuarios")) db.deleteObjectStore("usuarios");

    db.createObjectStore("cadastros", { keyPath: "id" });
    const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
    
    // Recriando o acesso mestre
    userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    sincronizarDadosDaNuvem();
    if(document.getElementById('contador-total')) atualizarMonitor();
    if(document.getElementById('lista-usuarios')) listarUsuarios();
};

// --- SINCRONIZAÇÃO (O que trouxe o Paulo) ---
async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => {
            console.log("Sincronização concluída.");
            atualizarMonitor();
        };
    } catch (error) { console.error("Erro na nuvem:", error); }
}

// --- LOGIN ---
function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    db.transaction("usuarios", "readonly").objectStore("usuarios").get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            if(u.perfil === "GESTOR") document.getElementById('secao-admin-users')?.classList.remove('hidden');
            atualizarMonitor();
            listarUsuarios();
        } else { alert("Código inválido!"); }
    };
}

// --- GESTÃO DE INTEGRANTES (A parte que estava faltando) ---
function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;

    if(!nome || !codigo) return alert("Preencha nome e código!");

    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").add({ codigo, nome, perfil });
    tx.oncomplete = () => {
        alert("Novo integrante cadastrado!");
        document.getElementById('novo-nome').value = "";
        document.getElementById('novo-codigo').value = "";
        listarUsuarios();
    };
}

function listarUsuarios() {
    const listaDiv = document.getElementById('lista-usuarios');
    if(!listaDiv) return;

    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = "<table style='width:100%; border-collapse: collapse;'>";
        e.target.result.forEach(u => {
            html += `<tr style='border-bottom: 1px solid #ddd; height: 40px;'>
                <td><strong>${u.nome}</strong><br><small>${u.perfil}</small></td>
                <td style='text-align:right;'>
                    ${u.codigo !== "1234" ? `<button onclick="excluirU('${u.codigo}')" style='color:red; background:none; border:none; cursor:pointer;'>Excluir</button>` : ""}
                </td>
            </tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };
}

function excluirU(c) {
    if(!confirm("Deseja remover este acesso?")) return;
    db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
}

// --- MONITOR E BUSCA ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        
        const filtrados = registros.filter(r => 
            (r.nome||"").toLowerCase().includes(termo) || 
            (r.sobrenome||"").toLowerCase().includes(termo) || 
            (r.cpf||"").includes(termo) ||
            (r.bairro||"").toLowerCase().includes(termo)
        );

        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `
                <div class="item-lista" onclick="prepararEdicao('${r.id}')" style="border-bottom: 1px solid #eee; padding: 10px; cursor: pointer;">
                    <strong>${r.nome} ${r.sobrenome}</strong> <small>(${r.bairro || 'Sem Bairro'})</small><br>
                    <span style="font-size:0.75em; color:#777;">CPF: ${r.cpf}</span>
                </div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";
        
        // Ranking de Bairros
        const bairros = {};
        registros.forEach(r => { if(r.bairro) bairros[r.bairro.toUpperCase()] = (bairros[r.bairro.toUpperCase()] || 0) + 1; });
        const ranking = Object.entries(bairros).sort((a,b) => b[1]-a[1]).slice(0,5);
        const statsDiv = document.getElementById('stats-bairros');
        if(statsDiv) statsDiv.innerHTML = "Top Bairros: " + ranking.map(b => `${b[0]}(${b[1]})`).join(" | ");
    };
}

// --- SALVAR CADASTRO ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value;
    const userAtual = document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!nome || !cpf) return alert("Nome e CPF são obrigatórios!");

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        origem: document.getElementById('origem').value,
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpf,
        sexo: document.getElementById('sexo').value,
        nascimento: document.getElementById('nascimento').value,
        whatsapp: document.getElementById('whatsapp').value.replace(/\D/g, ''),
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        criado_por: userAtual,
        criado_em: new Date().toLocaleString()
    };

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        const tx = db.transaction("cadastros", "readwrite");
        tx.objectStore("cadastros").put(registro);
        tx.oncomplete = () => {
            alert("Sucesso!");
            cancelarEdicao();
            atualizarMonitor();
        };
    } catch (e) { alert("Erro ao salvar."); }
}

function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        const campos = ["nome", "sobrenome", "cpf", "sexo", "nascimento", "whatsapp", "email", "cep", "bairro", "logradouro", "numero", "tipo", "origem"];
        campos.forEach(c => { if(document.getElementById(c)) document.getElementById(c).value = r[c] || ""; });
        document.getElementById('edit-id').value = r.id;
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() {
    document.getElementById('edit-id').value = "";
    document.getElementById('titulo-form').innerText = "Novo Cadastro";
    document.getElementById('botoes-acao').classList.remove('hidden');
    document.getElementById('botoes-edicao').classList.add('hidden');
    document.querySelectorAll('#form-cadastro input').forEach(i => i.value = "");
}

function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jgua_backup_${new Date().getTime()}.json`;
        a.click();
    };
}

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
        if(!d.erro) {
            document.getElementById('logradouro').value = d.logradouro;
            document.getElementById('bairro').value = d.bairro;
        }
    });
}
