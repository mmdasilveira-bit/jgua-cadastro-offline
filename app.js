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
    console.log("Sistema JGUA - Operacional (Modo WhatsApp Ativo)");
    if(document.getElementById('contador-total')) atualizarMonitor();
    if(document.getElementById('lista-usuarios')) listarUsuarios();
};

// --- VALIDADOR DE CPF ---
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '' || cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
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

// --- AUTENTICAÇÃO ---
function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    const consulta = store.get(cod);

    consulta.onsuccess = () => {
        const usuario = consulta.result;
        if (usuario) {
            const perfil = usuario.perfil;
            document.getElementById('label-perfil').innerText = perfil;
            document.getElementById('label-nome-user').innerText = usuario.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            
            if(perfil === "CADASTRADOR") document.getElementById('monitor')?.classList.add('hidden');
            if(perfil === "CADASTRADOR" || perfil === "VALIDADOR") document.getElementById('btn-exportar')?.classList.add('hidden');
            if(perfil !== "GESTOR") document.getElementById('secao-admin-users')?.classList.add('hidden');
            
            atualizarMonitor();
        } else { alert("Código inválido!"); }
    };
}

// --- SALVAR COM CONFIRMAÇÃO DE WHATSAPP ---
async function salvar() {
    const cpfValor = document.getElementById('cpf').value;
    const whats = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const nome = document.getElementById('nome').value.trim();
    const sexo = document.getElementById('sexo').value;
    const nasc = document.getElementById('nascimento').value;

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!sexo || !nasc || !nome) return alert("Preencha Nome, CPF, Sexo e Nascimento!");

    const dataNasc = new Date(nasc);
    let idade = new Date().getFullYear() - dataNasc.getFullYear();

    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value || "EQUIPE",
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpfValor,
        sexo: sexo,
        nascimento: nasc,
        idade: idade,
        whatsapp: whats,
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        data_cadastro: new Date().toLocaleString(),
        autor: document.getElementById('label-nome-user').innerText
    };

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
        salvarLocalmente(registro, whats, nome);
    } catch (e) { 
        salvarLocalmente(registro, whats, nome); 
    }
}

function salvarLocalmente(registro, whats, nome) {
    const tx = db.transaction("cadastros", "readwrite");
    const store = tx.objectStore("cadastros");
    const requestAdd = store.add(registro);
    
    requestAdd.onsuccess = () => {
        // Lógica de confirmação de WhatsApp
        if (whats.length >= 10) {
            if (confirm(`Cadastro de ${nome} realizado! Deseja enviar mensagem de confirmação via WhatsApp agora?`)) {
                const msg = window.encodeURIComponent(`Olá ${nome}, seu cadastro no JGUA foi realizado com sucesso! Seja bem-vindo(a).`);
                window.open(`https://api.whatsapp.com/send?phone=55${whats}&text=${msg}`, '_blank');
            }
        } else {
            alert("Cadastro realizado com sucesso!");
        }
        
        limparCampos();
        atualizarMonitor();
    };
    requestAdd.onerror = () => alert("ALERTA: Este CPF já foi cadastrado!");
}

function limparCampos() {
    ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero"].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = "";
    });
}

// --- MONITOR E ESTATÍSTICAS ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    
    store.getAll().onsuccess = (e) => {
        const registros = e.target.result;
        const total = registros.length;
        document.getElementById('contador-total').innerText = total;

        if (total > 0) {
            const bairrosContagem = {};
            registros.forEach(r => {
                const b = r.bairro ? r.bairro.toUpperCase() : "NÃO INFORMADO";
                bairrosContagem[b] = (bairrosContagem[b] || 0) + 1;
            });
            const ranking = Object.entries(bairrosContagem).sort((a,b) => b[1] - a[1]).slice(0, 5);
            let bairrosHtml = "";
            ranking.forEach(([nome, qtd]) => {
                bairrosHtml += `<div style="display:flex; justify-content:space-between; font-size:0.8em; border-bottom:1px dashed #ccc; padding:2px 0;"><span>${nome}</span> <strong>${qtd}</strong></div>`;
            });
            document.getElementById('stats-bairros').innerHTML = bairrosHtml;

            const idades = registros.map(r => r.idade).filter(id => !isNaN(id));
            const media = idades.length > 0 ? idades.reduce((a, b) => a + b, 0) / idades.length : 0;
            document.getElementById('media-idade').innerText = Math.round(media);
        }
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
        }
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
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    if (!nome || !codigo) return alert("Preencha Nome e Código!");
    db.transaction("usuarios", "readwrite").objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Integrante registrado!");
        listarUsuarios();
    };
}

function listarUsuarios() {
    if(!document.getElementById('lista-usuarios')) return;
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = '<table style="width:100%; font-size:0.9em;">';
        e.target.result.forEach(u => {
            html += `<tr style="border-bottom:1px solid #eee;"><td>${u.nome} (${u.perfil})</td><td style="text-align:right;"><button onclick="excluirUsuario('${u.codigo}')">X</button></td></tr>`;
        });
        document.getElementById('lista-usuarios').innerHTML = html + '</table>';
    };
}

function excluirUsuario(c) {
    if(c === "1234") return alert("Não é possível excluir o Gestor Mestre!");
    if(confirm("Remover este acesso?")) {
        db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
    }
}

function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jgua_export_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        a.click();
    };
}
