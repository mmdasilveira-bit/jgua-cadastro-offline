const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Usamos JGUA_FINAL_DB_V2 para forçar um reset completo no seu navegador Linux
const request = indexedDB.open("JGUA_FINAL_DB_V2", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    const store = db.createObjectStore("cadastros", { keyPath: "id" });
    store.createIndex("cpf", "cpf", { unique: true });

    const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
    userStore.add({ codigo: "1234", nome: "GESTOR MESTRE", perfil: "GESTOR" });
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    console.log("Banco aberto com sucesso.");
    sincronizarDadosDaNuvem();
};

async function sincronizarDadosDaNuvem() {
    try {
        const response = await fetch(URL_PLANILHA, { method: "GET", redirect: "follow" });
        const registrosNuvem = await response.json();
        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        registrosNuvem.forEach(reg => { if (reg.id) store.put(reg); });
        tx.oncomplete = () => {
            console.log("Sincronização OK: " + registrosNuvem.length);
            atualizarMonitor();
        };
    } catch (error) { console.error("Falha na sincronização:", error); }
}

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
            atualizarMonitor();
            listarUsuarios();
        } else { alert("Código inválido!"); }
    };
}

function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    const termo = document.getElementById('input-busca').value.toLowerCase();
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        const filtrados = registros.filter(r => 
            (r.nome||"").toLowerCase().includes(termo) || 
            (r.cpf||"").includes(termo) ||
            (r.bairro||"").toLowerCase().includes(termo)
        );
        let html = "";
        filtrados.reverse().slice(0, 20).forEach(r => {
            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')" style="border-bottom:1px solid #eee; padding:10px; cursor:pointer;">
                <strong>${r.nome} ${r.sobrenome||""}</strong><br><small>CPF: ${r.cpf}</small></div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Nenhum resultado.";
    };
}

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    if(!nome || !codigo) return alert("Preencha nome e código!");
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").add({ codigo, nome, perfil }).onsuccess = () => {
        alert("Cadastrado!");
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
            html += `<tr style='border-bottom: 1px solid #ddd;'>
                <td style='padding:8px;'><strong>${u.nome}</strong><br><small>${u.perfil}</small></td>
                <td style='text-align:right;'>
                    ${u.codigo !== '1234' ? `<button onclick="excluirU('${u.codigo}')" style='color:red; border:none; background:none; cursor:pointer;'>[X]</button>` : 'Mestre'}
                </td></tr>`;
        });
        listaDiv.innerHTML = html + "</table>";
    };
}

function excluirU(c) {
    if(confirm("Excluir?")) {
        db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
    }
}

async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value;
    if (!nome || !cpf) return alert("Nome e CPF obrigatórios!");
    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        tipo: document.getElementById('tipo').value, 
        origem: document.getElementById('origem').value,
        nome: nome,
        sobrenome: document.getElementById('sobrenome').value,
        cpf: cpf,
        whatsapp: document.getElementById('whatsapp').value,
        bairro: document.getElementById('bairro').value,
        criado_por: document.getElementById('label-nome-user').innerText,
        criado_em: new Date().toLocaleString()
    };
    fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });
    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").put(registro);
    tx.oncomplete = () => { alert("Sucesso!"); location.reload(); };
}

function prepararEdicao(id) {
    db.transaction("cadastros", "readonly").objectStore("cadastros").get(id).onsuccess = (e) => {
        const r = e.target.result;
        const campos = ["nome", "sobrenome", "cpf", "whatsapp", "bairro", "tipo", "origem"];
        campos.forEach(c => { if(document.getElementById(c)) document.getElementById(c).value = r[c] || ""; });
        document.getElementById('edit-id').value = r.id;
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao').classList.add('hidden');
        document.getElementById('botoes-edicao').classList.remove('hidden');
    };
}

function cancelarEdicao() { location.reload(); }

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
            if(!d.erro) {
                document.getElementById('logradouro').value = d.logradouro;
                document.getElementById('bairro').value = d.bairro;
            }
        });
    }
}
