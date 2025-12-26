const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Mantemos a versão 12 para garantir que o banco aceite os IDs de texto da nuvem
const request = indexedDB.open("JGUA_DB", 12);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        const store = db.createObjectStore("cadastros", { keyPath: "id" });
        store.createIndex("cpf", "cpf", { unique: true });
    }
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    sincronizarDadosDaNuvem();
    if(document.getElementById('contador-total')) atualizarMonitor();
    if(document.getElementById('lista-usuarios')) listarUsuarios();
};

// --- VALIDADOR DE CPF ---
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    return rev == parseInt(cpf.charAt(10));
}

// --- LOGIN E PERMISSÕES ---
function autenticar() {
    const cod = document.getElementById('input-codigo').value;
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
            
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            if(u.perfil === "GESTOR") {
                if(document.getElementById('secao-admin-users')) document.getElementById('secao-admin-users').classList.remove('hidden');
            }
            
            atualizarMonitor();
            listarUsuarios();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR / EDITAR COM AUDITORIA COMPLETA ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    const userAtual = document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!nome) return alert("O Nome é obrigatório!");

    const nasc = document.getElementById('nascimento').value;
    const whats = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const idadeCalculada = nasc ? new Date().getFullYear() - new Date(nasc).getFullYear() : 0;

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpfValor,
        sexo: document.getElementById('sexo').value,
        nascimento: nasc,
        idade: idadeCalculada,
        whatsapp: whats,
        celular2: document.getElementById('celular2')?.value || "",
        telefone_fixo: document.getElementById('telefone_fixo')?.value || "",
        email: document.getElementById('email').value,
        instagram: document.getElementById('instagram')?.value || "",
        telegram: document.getElementById('telegram')?.value || "",
        signal: document.getElementById('signal')?.value || "",
        linkedin: document.getElementById('linkedin')?.value || "",
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
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
        const store = tx.objectStore("cadastros");
        
        if (editId) {
            store.get(editId).onsuccess = (e) => {
                const original = e.target.result;
                registro.criado_por = original.criado_por;
                registro.criado_em = original.criado_em;
                store.put(registro);
            };
        } else {
            store.add(registro);
        }

        alert("Operação concluída!");
        if (!editId && whats.length >= 10 && confirm("Enviar WhatsApp?")) {
            const msg = window.encodeURIComponent(`Olá ${nome}, seu cadastro no JGUA foi concluído!`);
            window.open(`https://api.whatsapp.com/send?phone=55${whats}&text=${msg}`, '_blank');
        }
        cancelarEdicao();
        atualizarMonitor();
    } catch (e) { alert("Erro ao processar."); }
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
            (r.cpf||"").includes(termo) || 
            (r.bairro && r.bairro.toLowerCase().includes(termo))
        );

        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')"> 
                <strong>${r.nome}</strong> <small>(${r.bairro || '---'})</small><br>
                <span style="font-size:0.75em;">CPF: ${r.cpf} | Idade: ${r.idade}</span>
            </div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";

        // Estatísticas
        const bairros = {};
        registros.forEach(r => { if(r.bairro) bairros[r.bairro.toUpperCase()] = (bairros[r.bairro.toUpperCase()] || 0) + 1; });
        const ranking = Object.entries(bairros).sort((a,b) => b[1]-a[1]).slice(0,5);
        document.getElementById('stats-bairros').innerHTML = "Top Bairros: " + ranking.map(b => `${b[0]}(${b[1]})`).join(" | ");
        
        const idades = registros.map(r => r.idade).filter(i => i > 0);
        document.getElementById('media-idade').innerText = idades.length ? Math.round(idades.reduce((a,b)=>a+b)/idades.length) : 0;
    };
}

// --- CEP ---
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

// --- GESTÃO DE USUÁRIOS ---
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

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value;
    const codigo = document.getElementById('novo-codigo').value;
    const perfil = document.getElementById('novo-perfil').value;
    db.transaction("usuarios", "readwrite").objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Criado!");
        listarUsuarios();
    };
}

function excluirU(c) {
    if(confirm("Excluir?")) db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
}

function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        document.getElementById('edit-id').value = r.id;
        const campos = ["nome", "sobrenome", "cpf", "sexo", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero", "tipo", "origem", "celular2", "telefone_fixo", "instagram", "telegram", "signal", "linkedin"];
        campos.forEach(c => { if(document.getElementById(c)) document.getElementById(c).value = r[c] || ""; });
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() { location.reload(); }

async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => { atualizarMonitor(); };
    } catch (e) { console.error("Erro sincronia"); }
}

function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jgua_backup.json`;
        a.click();
    };
}
