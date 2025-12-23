let db;
// Abrimos a versão 2 para garantir a criação da tabela de usuários
const request = indexedDB.open("JGUA_DB", 2);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    
    // 1. Tabela de Cadastros de Pessoas
    if (!db.objectStoreNames.contains("cadastros")) {
        db.createObjectStore("cadastros", { keyPath: "id", autoIncrement: true });
    }
    
    // 2. Tabela de Usuários do Sistema (Integrantes da Equipe)
    if (!db.objectStoreNames.contains("usuarios")) {
        const userStore = db.createObjectStore("usuarios", { keyPath: "codigo" });
        
        // Criamos o GESTOR MESTRE padrão (Senha: 1234)
        userStore.add({ 
            codigo: "1234", 
            nome: "GESTOR MESTRE", 
            perfil: "GESTOR" 
        });
    }
};

request.onsuccess = (e) => { db = e.target.result; };

// --- FUNÇÃO PARA CRIAR NOVOS INTEGRANTES DA EQUIPE ---
function criarUsuario() {
    const perfilLogado = document.getElementById('label-perfil').innerText;
    const nome = document.getElementById('novo-nome').value.trim();
    const codigo = document.getElementById('novo-codigo').value.trim();
    const perfilNovo = document.getElementById('novo-perfil').value;

    if (!nome || !codigo) {
        alert("Por favor, preencha o nome e o código do novo integrante.");
        return;
    }

    // REGRA DE HIERARQUIA: Coordenador não cria Gestor nem outro Coordenador
    if (perfilLogado === "COORDENADOR" && (perfilNovo === "GESTOR" || perfilNovo === "COORDENADOR")) {
        alert("Atenção: Como COORDENADOR, você só pode cadastrar CADASTRADORES ou VALIDADORES.");
        return;
    }

    const tx = db.transaction("usuarios", "readwrite");
    const store = tx.objectStore("usuarios");
    
    const novoUsuario = { codigo, nome, perfil: perfilNovo };
    
    const pedido = store.add(novoUsuario);

    pedido.onsuccess = () => {
        alert(`Sucesso! ${nome} agora é um ${perfilNovo} no sistema.`);
        // Limpa os campos do painel admin
        document.getElementById('novo-nome').value = "";
        document.getElementById('novo-codigo').value = "";
    };

    pedido.onerror = () => {
        alert("Erro: Este código de acesso já está em uso por outro integrante.");
    };
}

// --- FUNÇÕES DE CADASTRO DE PESSOAS E CEP (MANTIDAS) ---

async function buscarCEP() {
    let campoCep = document.getElementById('cep');
    let cep = campoCep.value.replace(/\D/g, ''); 
    if (cep.length !== 8) return;

    try {
        const response = await fetch('cep_base_jgs.json');
        const baseLocal = await response.json();
        const resultado = baseLocal[cep]; 

        if (resultado && resultado.length > 0) {
            const dados = resultado[0];
            document.getElementById('logradouro').value = dados.logradouro || '';
            document.getElementById('bairro').value = dados.bairro || '';
            document.getElementById('cidade').value = 'Jaraguá do Sul';
            document.getElementById('uf').value = 'SC';
        } else if (navigator.onLine) {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();
            if (!dados.erro) {
                document.getElementById('logradouro').value = dados.logradouro;
                document.getElementById('bairro').value = dados.bairro;
                document.getElementById('cidade').value = dados.localidade;
                document.getElementById('uf').value = dados.uf;
            }
        }
    } catch (e) {
        console.error("Erro ao carregar base de CEPs:", e);
    }
}

function salvar() {
    const perfil = document.getElementById('label-perfil').innerText;
    const registro = {
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value,
        nome: document.getElementById('nome').value,
        sobrenome: document.getElementById('sobrenome').value,
        cpf: document.getElementById('cpf').value,
        nascimento: document.getElementById('nascimento').value,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        instagram: document.getElementById('instagram').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        numero: document.getElementById('numero').value,
        data_cadastro: new Date().toLocaleString(),
        cadastrado_por: perfil
    };

    const tx = db.transaction("cadastros", "readwrite");
    tx.objectStore("cadastros").add(registro);
    tx.oncomplete = () => {
        alert("Cadastro realizado com sucesso!");
        // Limpa formulário (menos campos fixos)
        ["nome", "sobrenome", "cpf", "nascimento", "whatsapp", "email", "instagram", "cep", "logradouro", "bairro", "numero"].forEach(id => {
            document.getElementById(id).value = "";
        });
    };
}

function exportarDados() {
    const perfil = document.getElementById('label-perfil').innerText;
    const tx = db.transaction("cadastros", "readonly");
    tx.objectStore("cadastros").getAll().onsuccess = (e) => {
        let dados = e.target.result;
        // REGRA DE EXPORTAÇÃO: Apenas GESTOR vê CPF real
        if (perfil !== "GESTOR") {
            dados = dados.map(item => ({ ...item, cpf: "PROTEGIDO" }));
        }
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cadastros_jgua_${perfil.toLowerCase()}.json`;
        a.click();
    };
}
