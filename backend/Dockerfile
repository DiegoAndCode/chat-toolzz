# Use uma imagem oficial do Node.js como base
FROM node:22

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia o package.json e o package-lock.json para o diretório de trabalho
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia todos os arquivos do projeto para dentro do contêiner
COPY . .

# Expõe a porta 3001 do contêiner
EXPOSE 3001

# Comando para rodar o servidor
CMD ["npm", "run", "dev"]
