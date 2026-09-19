-- Alem do mova_dev (criado por POSTGRES_DB), cria o banco exclusivo da suite.
-- Assim os testes truncam tabelas que nao pertencem a nenhum outro ambiente.
CREATE DATABASE mova_test OWNER mova;
