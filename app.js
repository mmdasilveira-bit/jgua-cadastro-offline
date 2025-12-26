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
    console.log("Iniciando sincronização forçada...");
    try {
        const response = await fetch(URL_PLANILHA + "?t=" + new Date().getTime(), { 
            method: "GET", 
            redirect: "follow",
            cache: "no-store" 
        });
        
        const registrosNuvem = await response.json();
        console.log("Registros recebidos da nuvem:", registrosNuvem.length);

        if (!registrosNuvem || registrosNuvem.length === 0) return;

        const tx = db.transaction("cadastros", "readwrite");
        const store = tx.objectStore("cadastros");
        
        // Limpa o banco local antes de colocar os dados da nuvem para evitar conflitos
        // store.clear(); // Opcional: use se quiser que o banco local seja idêntico à planilha

        registrosNuvem.forEach(reg => { 
            // Garante que o ID seja sempre uma String para evitar erro de busca
            if (reg.id) {
                reg.id = String(reg.id);
                store.put(reg); 
            }
        });
        
        tx.oncomplete = () => {
            console.log("Sincronia concluída! Banco atualizado.");
            atualizarMonitor();
        };
    } catch (error) { 
        console.error("Erro na busca da nuvem:", error); 
    }
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

    if (!nome || !cpf) return alert("Campos obrigatórios: Nome e CPF!");

    const registro = {
        id: editId || "CAD-" + new Date().getTime(),
        Tipo: document.getElementById('tipo').value, 
        Nome: nome,
        Sobrenome: document.getElementById('sobrenome')?.value || "",
        CPF: cpf,
        WhatsApp: document.getElementById('whatsapp').value,
        Bairro: document.getElementById('bairro').value,
        Origem: document.getElementById('origem').value,
        // Adicione aqui outros campos seguindo o mesmo padrão se necessário
        Atualizado_Por: userAtual,
        Atualizado_Em: new Date().toLocaleString()
    };

    if (!editId) {
        registro.Criado_Por = userAtual;
        registro.Criado_Em = new Date().toLocaleString();
    }

    try {
        // Envia para a Planilha Google
        fetch(URL_PLANILHA, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(registro) 
        });

        // Grava no Banco Local (IndexedDB)
        const tx = db.transaction("cadastros", "readwrite");
        tx.objectStore("cadastros").put(registro);
        
        tx.oncomplete = () => {
            alert(editId ? "Cadastro Atualizado!" : "Novo Cadastro Salvo!");
            location.reload(); 
        };
    } catch (e) { 
        alert("Erro ao salvar."); 
    }
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

            html += `<div class="item-lista" onclick="prepararEdicao('${r.id}')" style="border-bottom:1px solid #eee; padding:10px; cursor:pointer;">
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

function prepararEdicao(id) {
    console.log("Iniciando edição do ID:", id);
    
    // Garantia: Se o banco fechou, tentamos usar a variável global ou avisar
    if (!db) {
        console.error("Banco de dados não disponível.");
        alert("Erro técnico: O banco de dados não está pronto. Recarregue a página.");
        return;
    }

    try {
        const tx = db.transaction("cadastros", "readonly");
        const store = tx.objectStore("cadastros");
        const request = store.get(String(id));

        request.onsuccess = (e) => {
            const r = e.target.result;
            if (!r) {
                console.warn("Registro não encontrado para o ID:", id);
                return;
            }

            console.log("Dados encontrados:", r);

            // Mapeamento IDs do HTML -> Colunas do Banco
            const campos = {
                'nome': r.Nome || r.nome,
                'sobrenome': r.Sobrenome || r.sobrenome,
                'cpf': r.CPF || r.cpf,
                'whatsapp': r.WhatsApp || r.whatsapp,
                'bairro': r.Bairro || r.bairro,
                'tipo': r.Tipo || r.tipo,
                'origem': r.Origem || r.origem,
                'data_nascimento': r.Data_Nascimento || r.data_nascimento
            };

            for (let idHtml in campos) {
                const el = document.getElementById(idHtml);
                if (el) {
                    el.value = campos[idHtml] || "";
                    console.log(`Campo ${idHtml} preenchido com:`, campos[idHtml]);
                }
            }

            // Ativa o modo de edição visual
            if (document.getElementById('edit-id')) document.getElementById('edit-id').value = r.id;
            if (document.getElementById('titulo-form')) document.getElementById('titulo-form').innerText = "Atualizar Cadastro";
            
            document.getElementById('botoes-acao')?.classList.add('hidden');
            document.getElementById('botoes-edicao')?.classList.remove('hidden');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        request.onerror = (err) => {
            console.error("Erro na busca do registro:", err);
        };

    } catch (err) {
        console.error("Falha ao iniciar transação:", err);
    }
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
