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
            
            // Trava visual apenas para o monitor, mas a edição agora é permitida se o usuário buscar
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            if(u.perfil === "CADASTRADOR" || u.perfil === "VALIDADOR") {
                if(document.getElementById('btn-exportar')) document.getElementById('btn-exportar').classList.add('hidden');
            }
            if(u.perfil === "GESTOR") {
                if(document.getElementById('secao-admin-users')) document.getElementById('secao-admin-users').classList.remove('hidden');
            }
            
            atualizarMonitor();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR / EDITAR COM AUDITORIA (33 COLUNAS) ---
async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const cpfValor = document.getElementById('cpf').value;
    const nome = document.getElementById('nome').value.trim();
    const userAtual = window.labelNomeUser_Forced || document.getElementById('label-nome-user')?.innerText || "SISTEMA";

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!nome) return alert("O Nome é obrigatório!");

    const nasc = document.getElementById('nascimento').value;
    const whats = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const idadeCalculada = nasc ? new Date().getFullYear() - new Date(nasc).getFullYear() : 0;

    // Objeto completo para a Planilha e IndexedDB
    const registro = {
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
        origem: document.getElementById('origem').value
    };

    if (editId) {
        registro.id = Number(editId);
        registro.atualizado_por = userAtual;
        registro.atualizado_em = new Date().toLocaleString();
        // Preservamos a data de criação original no IndexedDB recuperando o registro antes de salvar
    } else {
        registro.criado_por = userAtual;
        registro.criado_em = new Date().toLocaleString();
    }

    try {
        // Envio para a Planilha Google
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        
        let req;
        if (editId) {
            // Se for edição, buscamos o original para manter dados de criação que não estão no form
            store.get(registro.id).onsuccess = (e) => {
                const original = e.target.result;
                registro.criado_por = original.criado_por;
                registro.criado_em = original.criado_em;
                store.put(registro);
            };
        } else {
            store.add(registro);
        }

        alert(editId ? "Cadastro atualizado!" : "Cadastro realizado!");
        
        // WhatsApp apenas para novos cadastros
        if (!editId && whats.length >= 10) {
            if (confirm("Deseja enviar WhatsApp de boas-vindas?")) {
                const msg = window.encodeURIComponent(`Olá ${nome}, seu cadastro no JGUA foi concluído!`);
                window.open(`https://api.whatsapp.com/send?phone=55${whats}&text=${msg}`, '_blank');
            }
        }
        
        cancelarEdicao();
        atualizarMonitor();
    } catch (e) { alert("Erro ao processar."); }
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
        
        // Novos campos (redes sociais e tel extra)
        if(document.getElementById('celular2')) document.getElementById('celular2').value = r.celular2 || "";
        if(document.getElementById('telefone_fixo')) document.getElementById('telefone_fixo').value = r.telefone_fixo || "";
        if(document.getElementById('instagram')) document.getElementById('instagram').value = r.instagram || "";
        if(document.getElementById('telegram')) document.getElementById('telegram').value = r.telegram || "";
        if(document.getElementById('signal')) document.getElementById('signal').value = r.signal || "";
        if(document.getElementById('linkedin')) document.getElementById('linkedin').value = r.linkedin || "";

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
    const campos = ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero", "celular2", "telefone_fixo", "instagram", "telegram", "signal", "linkedin"];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
}

// --- MONITOR E BUSCA UNIVERSAL ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;

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
    if(!document.getElementById('lista-usuarios')) return;
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
