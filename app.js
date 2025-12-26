const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbziH71TxS7YCz_-b8SjbjtXi1dLO0TTYmAHJF5vBHUmMrmo-ujJxHif0aY3ZOQduv552Q/exec"; 

let db;
// Usamos a versão 20 que você confirmou estar estável no Firefox
const request = indexedDB.open("JGUA_FINAL_DB", 20); 

// Trava o botão inicialmente para evitar o erro de "undefined" no Chrome
const btnAcessar = document.querySelector('button[onclick="autenticar()"]');
if (btnAcessar) {
    btnAcessar.disabled = true;
    btnAcessar.innerText = "Carregando Banco...";
}

request.onsuccess = (e) => { 
    db = e.target.result; 
    console.log("Banco pronto no Chrome.");
    
    // Libera o botão apenas quando a variável 'db' está preenchida
    if (btnAcessar) {
        btnAcessar.disabled = false;
        btnAcessar.innerText = "Acessar Sistema";
    }
    sincronizarDadosDaNuvem();
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
        const response = await fetch(URL_PLANILHA + "?t=" + new Date().getTime(), { method: "GET", redirect: "follow", cache: "no-store" });
        const registrosNuvem = await response.json();
        if (!registrosNuvem) return;

        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        store.clear(); // Limpa para não duplicar

        registrosNuvem.forEach(reg => { 
            if (reg.Cadastrador_ID) {
                reg.id = String(reg.Cadastrador_ID);
                store.put(reg); 
            }
        });
        tx.oncomplete = () => atualizarMonitor();
    } catch (e) { console.error("Erro na nuvem:", e); }
}

function autenticar() {
    const cod = document.getElementById('input-codigo').value;
    
    if (!db) {
        alert("O banco de dados ainda não carregou. Aguarde um instante.");
        return;
    }

    const tx = db.transaction("usuarios", "readonly");
    const store = tx.objectStore("usuarios");
    
    store.get(cod).onsuccess = (e) => {
        const u = e.target.result;
        if (u) {
            document.getElementById('label-perfil').innerText = u.perfil;
            document.getElementById('label-nome-user').innerText = u.nome;
            document.getElementById('secao-login').classList.add('hidden');
            document.getElementById('conteudo').classList.remove('hidden');
            
            if(u.perfil === "CADASTRADOR") document.getElementById('monitor').classList.add('hidden');
            if(u.perfil === "GESTOR") document.getElementById('secao-admin-users')?.classList.remove('hidden');
            
            // FORÇA O CHROME A ACORDAR A SINCRONIZAÇÃO AQUI
            sincronizarDadosDaNuvem(); 
            
            atualizarMonitor();
            listarUsuarios();
        } else { 
            alert("Código inválido!"); 
        }
    };
}


async function salvar() {
    const editId = document.getElementById('edit-id').value;
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value;
    const userAtual = document.getElementById('label-nome-user').innerText;

    if (!nome || !cpf) return alert("Nome e CPF são obrigatórios!");

    const registro = {
        "Cadastrador_ID": editId || "CAD-" + new Date().getTime(),
        "Status": "Ativo", 
        "Perfil": document.getElementById('tipo').value, // Associado ou Adepto
        "Nome": nome,
        "Sobrenome": document.getElementById('sobrenome').value,
        "CPF": cpf,
        "WhatsApp": document.getElementById('whatsapp').value,
        "Bairro": document.getElementById('bairro').value,
        "Canal_Preferencial": document.getElementById('origem').value,
        "Data_Nascimento": document.getElementById('data_nascimento').value,
        "Atualizado_Por": userAtual,
        "Atualizado_Em": new Date().toLocaleString()
    };

    try {
        fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: JSON.stringify(registro) });

        const tx = db.transaction("cadastros", "readwrite");
        const registroLocal = {...registro, id: String(registro.Cadastrador_ID)};
        tx.objectStore("cadastros").put(registroLocal);
        
        tx.oncomplete = () => {
            alert(editId ? "Cadastro atualizado!" : "Cadastrado com sucesso!");
            location.reload(); 
        };
    } catch (e) { alert("Erro ao salvar."); }
}

function criarUsuario() {
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfil = document.getElementById('novo-perfil').value;
    const tx = db.transaction("usuarios", "readwrite");
    tx.objectStore("usuarios").put({ codigo, nome, perfil });
    tx.oncomplete = () => {
        alert("Acesso Criado!");
        listarUsuarios();
    };
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

function atualizarMonitor() {
    if (!db || !document.getElementById('contador-total')) return;
    
    db.transaction("cadastros", "readonly").objectStore("cadastros").getAll().onsuccess = (e) => {
        const registros = e.target.result;
        document.getElementById('contador-total').innerText = registros.length;
        
        let somaIdades = 0;
        let contagemComData = 0;
        const hoje = new Date();

        registros.forEach(r => {
            // Tenta pegar a data tanto com D maiúsculo quanto minúsculo
            const dataNascRaw = r.Data_Nascimento || r.data_nascimento || r.nascimento;
            
            if (dataNascRaw) {
                const nasc = new Date(dataNascRaw);
                if (!isNaN(nasc.getTime())) {
                    let idade = hoje.getFullYear() - nasc.getFullYear();
                    const m = hoje.getMonth() - nasc.getMonth();
                    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
                        idade--;
                    }
                    if (idade >= 0 && idade < 120) { // Validação simples de idade real
                        somaIdades += idade;
                        contagemComData++;
                    }
                }
            }
        });

        const media = contagemComData > 0 ? Math.round(somaIdades / contagemComData) : 0;
        const labelMedia = document.getElementById('media-idade');
        if(labelMedia) labelMedia.innerText = "Média Idade: " + media;

        let html = "";
        registros.reverse().slice(0, 20).forEach(r => {
            // Tenta Nome ou nome / Bairro ou bairro / CPF ou cpf
            const vNome = r.Nome || r.nome || "Sem Nome";
            const vBairro = r.Bairro || r.bairro || "---";
            const vCPF = r.CPF || r.cpf || "---";
            const vNasc = r.Data_Nascimento || r.data_nascimento || "---";

            html += `<div class="item-lista" onclick="('${r.id}')" style="border-bottom:1px solid #eee; padding:10px; cursor:pointer;">
                <strong>${vNome}</strong> - ${vBairro}<br>
                <small>CPF: ${vCPF} | Nasc: ${vNasc}</small></div>`;
        });
        document.getElementById('lista-cadastros').innerHTML = html || "Vazio.";
    };
}


function excluirU(c) {
    if(confirm("Excluir?")) {
        db.transaction("usuarios", "readwrite").objectStore("usuarios").delete(c).onsuccess = () => listarUsuarios();
    }
}

function prepararEdicao(idOriginal) {
    console.log("Editando ID:", idOriginal);
    if (!db) return;

    const tx = db.transaction("cadastros", "readonly");
    const store = tx.objectStore("cadastros");
    const request = store.get(String(idOriginal));

    request.onsuccess = (e) => {
        let r = e.target.result;
        if (!r && typeof idOriginal === "string") return prepararEdicao(Number(idOriginal));
        if (!r) return;

        // Mapeamento exato da sua planilha
        const mapa = {
            'nome': r.Nome,
            'sobrenome': r.Sobrenome,
            'cpf': r.CPF,
            'whatsapp': r.WhatsApp,
            'bairro': r.Bairro,
            'data_nascimento': r.Data_Nascimento,
            'tipo': r.Perfil,            // Associado ou Adepto
            'origem': r.Canal_Preferencial
        };

        // Preenche e DESBLOQUEIA os campos (liberando o validador)
        for (let idHtml in mapa) {
            const el = document.getElementById(idHtml);
            if (el) {
                el.value = mapa[idHtml] || "";
                el.disabled = false; // Libera para editar
                el.readOnly = false;
            }
        }

        // Libera o botão salvar manualmente
        const btnSalvar = document.getElementById('btn-salvar');
        if (btnSalvar) btnSalvar.disabled = false;

        document.getElementById('edit-id').value = r.Cadastrador_ID || r.id || idOriginal;
        document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
        document.getElementById('botoes-acao')?.classList.add('hidden');
        document.getElementById('botoes-edicao')?.classList.remove('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function cancelarEdicao() { 
    location.reload(); 
}

async function buscarCEP() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(d => {
            if(!d.erro) {
                if(document.getElementById('logradouro')) document.getElementById('logradouro').value = d.logradouro;
                if(document.getElementById('bairro')) document.getElementById('bairro').value = d.bairro;
            }
        });
    }
}
