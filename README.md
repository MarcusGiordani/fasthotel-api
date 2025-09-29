# Projeto FastHotel 🏨 - [Backend/Frontend]

Bem-vindo ao repositório do **[Backend/Frontend]** do projeto FastHotel, um sistema de gerenciamento de hotelaria desenvolvido para fins acadêmicos.

---

## 📋 Sobre o Projeto

O FastHotel é uma aplicação completa que permite o gerenciamento de hóspedes, quartos, reservas e pagamentos, além de fornecer um dashboard com analytics para mineração de dados.

Este repositório contém o **[Backend da aplicação, desenvolvido em Node.js com Express e PostgreSQL / Frontend da aplicação, desenvolvido em React]**.

* **Link para o repositório do Backend:** https://github.com/MarcusGiordani/fasthotel-api
* **Link para o repositório do Frontend:** https://github.com/MarcusGiordani/fasthotel-app

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React, TypeScript, Styled-Components
* **Backend:** Node.js, Express.js, PostgreSQL
* **Autenticação:** JWT (JSON Web Tokens)

---

## ⚙️ Pré-requisitos

Antes de começar, você vai precisar ter as seguintes ferramentas instaladas em sua máquina:
* [**Node.js**](https://nodejs.org/en/) (versão 16 ou superior)
* [**PostgreSQL**](https://www.postgresql.org/download/) (banco de dados)
* [**Git**](https://git-scm.com/downloads) (para controle de versão)

---

## 🚀 Como Executar o Projeto

Siga os passos abaixo para configurar e rodar o projeto localmente. **É necessário ter o Backend e o Frontend rodando ao mesmo tempo.**

### 1. Configuração do Backend (`fasthotel-api`)

```bash
# Clone o repositório do backend
git clone [https://github.com/MarcusGiordani/fasthotel-api.git](https://github.com/MarcusGiordani/fasthotel-api.git)

# Navegue até a pasta do projeto
cd fasthotel-api

# Instale as dependências
npm install
Configuração do Banco de Dados:

Inicie o serviço do PostgreSQL em sua máquina.

Crie um novo banco de dados chamado fasthotel_db.

Execute os scripts SQL para criar as tabelas do projeto.

Variáveis de Ambiente:

Na raiz do projeto backend (fasthotel-api), crie um arquivo chamado .env.

Preencha o arquivo .env com suas credenciais do banco de dados e uma chave secreta para o JWT:

DB_USER=seu_usuario_postgres
DB_HOST=localhost
DB_DATABASE=fasthotel_db
DB_PASSWORD=sua_senha_postgres
DB_PORT=5432
JWT_SECRET=crie_uma_chave_secreta_aqui
Iniciando o Servidor Backend:

Bash

# Para iniciar o servidor
npm start
O servidor backend estará rodando em http://localhost:5000 (ou a porta que você configurou).

```

### 2. Configuração do Frontend (fasthotel-app)
```Bash

# Em um novo terminal, clone o repositório do frontend
git clone [https://github.com/MarcusGiordani/fasthotel-app.git](https://github.com/MarcusGiordani/fasthotel-app.git)

# Navegue até a pasta do projeto
cd fasthotel-app

# Instale as dependências
npm install
Variáveis de Ambiente:

Na raiz do projeto frontend (fasthotel-app), crie um arquivo chamado .env.

Adicione a seguinte linha, apontando para a URL do seu backend:

REACT_APP_API_URL=http://localhost:5000/api
Iniciando a Aplicação React:

Bash

# Para iniciar a aplicação
npm start
A aplicação estará disponível em http://localhost:3000.

```

📖 Uso
Após iniciar o frontend e o backend, acesse http://localhost:3000 no seu navegador. Você pode se registrar ou usar um usuário existente para fazer login e explorar as funcionalidades do sistema.
