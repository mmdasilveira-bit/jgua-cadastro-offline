const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwYtG7KWEf9_yH4BvxmgNptrQNA1MtlMXPlro-TN_Kd2lrY-WoiGYcrc8sxDvziTEeFzA/exec"; 

let db;
const request = indexedDB.open("JGUA_DB", 4);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cadastros")) {
        const store = db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
        store.createIndex("cpf", "cpf", { unique: true });
    }
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
    }
};

request.onsuccess = (e) => { 
    db = e.target.result; 
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
    if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
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
            if(u.perfil === "CADASTRADOR" || u.perfil === "VALIDADOR") document.getElementById('btn-exportar').classList.add('hidden');
            if(u.perfil === "GESTOR") document.getElementById('secao-admin-users').classList.remove('hidden');
            
            atualizarMonitor();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR / EDITAR COM AUDITORIA ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    const whats = document.getElementById('whatsapp').value.replace(/\D/g, '');

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!nome) return alert("O Nome é obrigatório!");

    const nasc = document.getElementById('nascimento').value;
    const idade = nasc ? new Date().getFullYear() - new Date(nasc).getFullYear() : 0;
    const userAtual = document.getElementById('label-nome-user').innerText;

   // Substitua o bloco do objeto 'registro' dentro da função salvar() no seu app.js
const registro = {
    tipo: document.getElementById('tipo').value, // Perfil
    nome: nome,
    sobrenome: document.getElementById('sobrenome').value.trim(),
    cpf: cpfValor,
    sexo: document.getElementById('sexo').value, // <-- LINHA REINCLUÍDA
    nascimento: nasc,
    whatsapp: whats,
    email: document.getElementById('email').value,
    cep: document.getElementById('cep').value,
    logradouro: document.getElementById('logradouro').value,
    bairro: document.getElementById('bairro').value,
    numero: document.getElementById('numero').value,
    origem: document.getElementById('origem').value, // TERCEIRO ou AUTO
    data_cadastro: new Date().toLocaleString(), // Criado_Em
    autor: window.labelNomeUser_Forced || document.getElementById('label-nome-user')?.innerText || "SISTEMA" // Criado_Por
};

    // Auditoria
    if (editId) {
        registro.id = Number(editId);
        registro.ultima_alteracao = `${userAtual} | ${new Date().toLocaleString()}`;
    } else {
        registro.autor = userAtual;
    }

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        const req = editId ? store.put(registro) : store.add(registro);

        req.onsuccess = () => {
            if (!editId && whats.length >= 10) {
                if (confirm("Deseja enviar WhatsApp de boas-vindas?")) {
                    const msg = window.encodeURIComponent(`Olá ${nome}, seu cadastro no JGUA foi concluído!`);
                    window.open(`https://api.whatsapp.com/send?phone=55${whats}&text=${msg}`, '_blank');
                }
            }
            alert(editId ? "Cadastro atualizado!" : "Cadastro realizado!");
            cancelarEdicao();
            atualizarMonitor();
        };
        req.onerror = () => alert("Erro: CPF já existe!");
    } catch (e) { alert("Erro ao salvar."); }
}

// --- CARREGAR PARA EDIÇÃO ---
function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        document.getElementById('edit-id').value = r.id;
        document.getElementById('nome').value = r.nome;
        document.getElementById('sobrenome').value = r.sobrenome;
        document.getElementById('cpf').value = r.cpf;
        document.getElementById('tipo').value = r.tipo;
        document.getElementById('sexo').value = r.sexo;
        document.getElementById('nascimento').value = r.nascimento;
        document.getElementById('whatsapp').value = r.whatsapp;
        document.getElementById('email').value = r.email;
        document.getElementById('cep').value = r.cep;
        document.getElementById('bairro').value = r.bairro;
        document.getElementById('logradouro').value = r.logradouro;
        document.getElementById('numero').value = r.numero;

        document.getElementById('titulo-form').innerText = "Editando Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
        window.scrollTo(0,0);
    };
}

function cancelarEdicao() {
    document.getElementById('edit-id').value = "";
    document.getElementById('titulo-form').innerText = "Novo Cadastro";
    document.getElementById('botoes-acao').classList.remove('hidden');
    document.getElementById('botoes-edicao').classList.add('hidden');
    ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero"].forEach(id => {
        document.getElementById(id).value = "";
    });
}

// --- MONITOR E BUSCA UNIVERSAL ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        const total = registros.length;
        document.getElementById('contador-total').innerText = total;

        const filtrados = registros.filter(r => 
            r.nome.toLowerCase().includes(termo) || 
            r.sobrenome.toLowerCase().includes(termo) || 
            r.cpf.includes(termo) || 
            (r.bairro && r.bairro.toLowerCase().includes(termo))
        );

        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `
                <div class="item-lista" onclick="prepararEdicao(${r.id})">
                    <strong>${r.nome} ${r.sobrenome}</strong> <small>(${r.bairro || 'Sem Bairro'})</small><br>
                    <span style="font-size:0.75em; color:#777;">CPF: ${r.cpf} | Idade: ${r.idade}</span>
                </div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";

        // Estatísticas simplificadas de Bairro
        const bairros = {};
        registros.forEach(r => { if(r.bairro) bairros[r.bairro.toUpperCase()] = (bairros[r.bairro.toUpperCase()] || 0) + 1; });
        const ranking = Object.entries(bairros).sort((a,b) => b[1]-a[1]).slice(0,5);
        document.getElementById('stats-bairros').innerHTML = "Top Bairros: " + ranking.map(b => `${b[0]}(${b[1]})`).join(" | ");
        
        const idades = registros.map(r => r.idade).filter(i => i > 0);
        document.getElementById('media-idade').innerText = idades.length ? Math.round(idades.reduce((a,b)=>a+b)/idades.length) : 0;
    };
}

// --- BUSCA CEP ---
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
        const response = await fetch('cep_base_jgs.json');
        const base = await response.json();
        const r = base[cep];
        if (r) {
            document.getElementById('logradouro').value = r[0].logradouro;
            document.getElementById('bairro').value = r[0].bairro;
        } else { throw new Error(); }
    } catch (e) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
            if(!d.erro) {
                document.getElementById('logradouro').value = d.logradouro;
                document.getElementById('bairro').value = d.bairro;
            }
        });
    }
}

// --- GESTÃO DE USUÁRIOS ---
function criarUsuario() {
    const nome = document.getElementById('novo-nome').value;
    const codigo = document.getElementById('novo-codigo').value;
    const perfil = document.getElementById('novo-perfil').value;
    db.transaction("usuarios", "readwrite").objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Integrante criado!");
        listarUsuarios();
    };
}

function listarUsuarios() {
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = "<table>";
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome} (${u.perfil})</td><td><button onclick="excluirU('${u.codigo}')">X</button></td></tr>`;
        });
        document.getElementById('lista-usuarios').innerHTML = html + "</table>";
    };
}

function excluirU(c) {
    if(c === "1234") return alert("Mestre não pode ser excluído.");
    db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
}

function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jgua_base_${new Date().getTime()}.json`;
        a.click();
    };
}
