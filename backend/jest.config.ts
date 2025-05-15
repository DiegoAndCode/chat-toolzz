import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',  // Configuração para transpilar arquivos .ts
  },
  moduleFileExtensions: ['ts', 'js'],
};

export default config;
