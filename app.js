const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwYtG7KWEf9_yH4BvxmgNptrQNA1MtlMXPlro-TN_Kd2lrY-WoiGYcrc8sxDvziTEeFzA/exec"; 

let db;
// Mantemos a versão 4 para garantir a estrutura de CPF único
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
    console.log("Sistema JGUA carregado com sucesso!");
    if(document.getElementById('contador-total')) {
        atualizarMonitor();
    }
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

// --- FUNÇÃO SALVAR (LOCAL + NUVEM) ---
async function salvar() {
    const campoCpf = document.getElementById('cpf');
    const cpfValor = campoCpf.value;
    const sexo = document.getElementById('sexo').value;
    const nasc = document.getElementById('nascimento').value;

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!sexo || !nasc) return alert("Preencha Nome, CPF, Sexo e Nascimento!");

    const dataNasc = new Date(nasc);
    let idade = new Date().getFullYear() - dataNasc.getFullYear();

    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value || "AUTO",
        nome: document.getElementById('nome').value.trim(),
        sobrenome: document.getElementById('sobrenome').value.trim(),
        cpf: cpfValor,
        sexo: sexo,
        nascimento: nasc,
        idade: idade,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        data_cadastro: new Date().toLocaleString(),
        autor: document.getElementById('label-perfil')?.innerText || "GESTOR MESTRE"
    };

    // Tenta enviar para a Planilha Google
    try {
        fetch(URL_PLANILHA, {
            method: 'POST',
            mode: 'no-cors', 
            body: JSON.stringify(registro)
        });
        salvarLocalmente(registro);
    } catch (error) {
        salvarLocalmente(registro);
    }
}

function salvarLocalmente(registro) {
    const tx = db.transaction("cadastros", "readwrite");
    const store = tx.objectStore("cadastros");
    const requestAdd = store.add(registro);
    
    requestAdd.onsuccess = () => {
        alert("Cadastro realizado!");
        if(window.location.pathname.includes("auto.html")) {
            location.reload();
        } else {
            limparCampos();
            atualizarMonitor();
        }
    };
    requestAdd.onerror = () => alert("Erro: CPF já cadastrado neste dispositivo!");
}

function limparCampos() {
    ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
}

// --- MONITOR E ESTATÍSTICAS ---
function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
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

            const masc = registros.filter(r => r.sexo === "M").length;
            const fem = registros.filter(r => r.sexo === "F").length;
            const outro = registros.filter(r => r.sexo === "O").length;
            document.getElementById('bar-masc').style.width = (masc / total * 100) + "%";
            document.getElementById('bar-fem').style.width = (fem / total * 100) + "%";
            document.getElementById('bar-outro').style.width = (outro / total * 100) + "%";

            const idades = registros.map(r => r.idade).filter(id => !isNaN(id));
            const media = idades.length > 0 ? idades.reduce((a, b) => a + b, 0) / idades.length : 0;
            document.getElementById('media-idade').innerText = Math.round(media);
            
            const assoc = registros.filter(r => r.tipo === "ASSOCIADO").length;
            document.getElementById('perc-assoc').innerText = Math.round((assoc/total)*100) + "%";
        }

        const filtrados = registros.filter(r => 
            r.nome.toLowerCase().includes(termo) || 
            r.cpf.includes(termo) || 
            (r.bairro && r.bairro.toLowerCase().includes(termo))
        );
        
        const listaDiv = document.getElementById('lista-cadastros');
        let html = '<table style="width:100%; border-collapse: collapse;">';
        [...filtrados].reverse().slice(0, 10).forEach(r => {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 5px 0;"><strong>${r.nome}</strong> (${r.idade}a)<br><small>${r.bairro}</small></td></tr>`;
        });
        listaDiv.innerHTML = html + '</table>';
    };
}

// --- BUSCA CEP ---
async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        const r = baseLocal[cep];
        if (r) {
            document.getElementById('logradouro').value = r[0].logradouro;
            document.getElementById('bairro').value = r[0].bairro;
        }
    } catch (e) { console.log("CEP offline"); }
}

// --- EXPORTAÇÃO ---
function exportarDados() {
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cadastros_jgua.json`;
        a.click();
    };
}
