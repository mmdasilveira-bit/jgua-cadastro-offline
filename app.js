let db;
// Abrindo o banco na versão 4 para garantir o índice de CPF
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
    // Só tenta atualizar o monitor se o painel de estatísticas existir na tela (index.html)
    if(document.getElementById('contador-total')) {
        atualizarMonitor();
    }
};

// --- UTILITÁRIO: VALIDADOR DE CPF ---
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

// --- MONITOR E ESTATÍSTICAS (SÓ RODA NO INDEX.HTML) ---
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
            // Ranking Bairros
            const bairrosContagem = {};
            registros.forEach(r => {
                const b = r.bairro ? r.bairro.toUpperCase() : "NÃO INFORMADO";
                bairrosContagem[b] = (bairrosContagem[b] || 0) + 1;
            });
            const ranking = Object.entries(bairrosContagem).sort((a,b) => b[1] - a[1]).slice(0, 5);
            let bairrosHtml = "";
            ranking.forEach(([nome, qtd]) => {
                bairrosHtml += `<div style="display:flex; justify-content:space-between; font-size:0.8em; border-bottom:1px dashed #ccc;"><span>${nome}</span> <strong>${qtd}</strong></div>`;
            });
            document.getElementById('stats-bairros').innerHTML = bairrosHtml;

            // Gênero
            const masc = registros.filter(r => r.sexo === "M").length;
            const fem = registros.filter(r => r.sexo === "F").length;
            const outro = registros.filter(r => r.sexo === "O").length;
            document.getElementById('bar-masc').style.width = (masc / total * 100) + "%";
            document.getElementById('bar-fem').style.width = (fem / total * 100) + "%";
            document.getElementById('bar-outro').style.width = (outro / total * 100) + "%";

            // Média Idade
            const idades = registros.map(r => r.idade).filter(id => !isNaN(id));
            const media = idades.reduce((a, b) => a + b, 0) / idades.length;
            document.getElementById('media-idade').innerText = Math.round(media);
            
            // Perfil
            const assoc = registros.filter(r => r.tipo === "ASSOCIADO").length;
            document.getElementById('perc-assoc').innerText = Math.round((assoc/total)*100) + "%";
        }

        const filtrados = registros.filter(r => r.nome.toLowerCase().includes(termo) || r.cpf.includes(termo) || r.bairro.toLowerCase().includes(termo));
        const listaDiv = document.getElementById('lista-cadastros');
        let html = '<table style="width:100%; border-collapse: collapse;">';
        [...filtrados].reverse().forEach(r => {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 5px 0;"><strong>${r.nome}</strong> (${r.idade}a)<br><small>${r.bairro}</small></td></tr>`;
        });
        listaDiv.innerHTML = html + '</table>';
    };
}

// --- SALVAR (COMPATÍVEL COM INDEX E AUTO) ---
function salvar() {
    const campoCpf = document.getElementById('cpf');
    const cpfValor = campoCpf.value;
    const sexo = document.getElementById('sexo').value;
    const nasc = document.getElementById('nascimento').value;

    if (!validarCPF(cpfValor)) return alert("CPF Inválido!");
    if (!sexo || !nasc) return alert("Sexo e Data de Nascimento são obrigatórios!");

    const dataNasc = new Date(nasc);
    let idade = new Date().getFullYear() - dataNasc.getFullYear();

    const tx = db.transaction("cadastros", "readwrite");
    const store = tx.objectStore("cadastros");
    const index = store.index("cpf");

    index.get(cpfValor).onsuccess = (e) => {
        if (e.target.result) return alert("Atenção: Este CPF já foi cadastrado!");
        
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
            autor: document.getElementById('label-perfil').innerText || "CIDADAO"
        };

        store.add(registro).onsuccess = () => {
            alert("Salvo!");
            
            // Se estiver no auto.html, ele vai exibir a mensagem de sucesso e recarregar
            if(window.location.pathname.includes("auto.html")) {
                document.body.innerHTML = "<div style='background:white; padding:30px; border-radius:15px; text-align:center; font-family:sans-serif;'><h2>Obrigado!</h2><p>Cadastro enviado com sucesso.</p><button onclick='location.reload()' style='padding:10px 20px; background:#28a745; color:white; border:none; border-radius:5px;'>Fazer outro cadastro</button></div>";
            } else {
                // Se estiver no index.html, limpa os campos e atualiza monitor
                ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "cep", "logradouro", "bairro", "numero", "idade-visual"].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.value = "";
                });
                document.getElementById('sexo').value = "";
                atualizarMonitor();
            }
        };
    };
}

// --- GESTÃO DE EQUIPE (SÓ PARA INDEX.HTML) ---
function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    if (!nome || !codigo) return alert("Preencha tudo!");
    db.transaction("usuarios", "readwrite").objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Cadastrado!");
        listarUsuarios();
    };
}

function listarUsuarios() {
    if(!document.getElementById('lista-usuarios')) return;
    db.transaction("usuarios", "readonly").objectStore("usuarios").getAll().onsuccess = (e) => {
        let html = '<table style="width:100%">';
        e.target.result.forEach(u => {
            html += `<tr><td>${u.nome}</td><td><button onclick="excluirUsuario('${u.codigo}')" style="background:red; color:white; padding:2px 5px; border-radius:3px; border:none;">X</button></td></tr>`;
        });
        document.getElementById('lista-usuarios').innerHTML = html + '</table>';
    };
}

function excluirUsuario(c) {
    if(confirm("Excluir este acesso?")) {
        db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
    }
}

// --- BUSCA DE CEP ---
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
    const perfil = document.getElementById('label-perfil').innerText;
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        let dados = e.target.result;
        if (perfil !== "GESTOR") dados = dados.map(i => ({ ...i, cpf: "PROTEGIDO" }));
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cadastros_${new Date().toLocaleDateString()}.json`;
        a.click();
    };
}
