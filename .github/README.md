# GitHub Actions & CI/CD Configuration

Esta carpeta contiene toda la configuración de CI/CD para el proyecto Midnight MCP Server.

## 📋 Workflows Disponibles

### 1. Unit Tests (`unit-tests.yml`)
**Propósito**: Ejecutar pruebas unitarias para validar cambios en la rama `feature/review-docs`

**Triggers**:
- Pull requests a `feature/review-docs`
- Push directo a `feature/review-docs`

**Características**:
- ✅ Ejecuta linting con ESLint
- ✅ Ejecuta pruebas unitarias con Jest
- ✅ Genera reportes de cobertura
- ✅ Reportes disponibles como artifacts
- ✅ Timeout: 20 minutos
- ✅ Node.js 22.15.1 (Docker-based)

### 2. CI Validation (`ci-validation.yml`)
**Propósito**: Validación completa del código incluyendo pruebas unitarias e integración

**Triggers**:
- Pull requests a `feature/review-docs`
- Push directo a `feature/review-docs`

**Características**:
- ✅ Ejecuta linting con ESLint
- ✅ Pruebas unitarias + integración
- ✅ Reportes de cobertura completos
- ✅ Reportes disponibles como artifacts
- ✅ Timeout: 30 minutos
- ✅ Node.js 22.15.1 (Docker-based)

### 3. E2E Tests (`e2e-tests.yml`)
**Propósito**: Pruebas end-to-end para validar la integración completa del sistema

**Triggers**:
- Pull requests a `main` y `develop`
- Push a `main` y `develop`
- Programado diariamente a las 2 AM UTC

**Características**:
- ✅ Múltiples versiones de Node.js (18.20.5, 20.x, 22.x)
- ✅ Diferentes suites de pruebas (stdio, eliza, jest)
- ✅ Tests de rendimiento
- ✅ Timeout: 45-60 minutos

## 🔧 Configuración de Branch Protection

### Rama Protegida: `feature/review-docs`

Para asegurar la calidad del código, la rama `feature/review-docs` tiene las siguientes protecciones:

#### Status Checks Requeridos
- `Unit Tests / unit-tests`
- `CI Validation / validate`

#### Reglas de Protección
- ✅ Requerir que los status checks pasen antes del merge
- ✅ Requerir que la rama esté actualizada
- ✅ Requerir resolución de conversaciones
- ✅ Requerir pull request antes del merge
- ✅ Requerir al menos 1 aprobación
- ✅ Descartar aprobaciones obsoletas

## 📊 Métricas y Reportes

### Cobertura de Código
- **Herramienta**: Jest Coverage
- **Archivo**: `coverage/lcov.info`
- **Formato**: HTML, JSON, LCOV
- **Retención**: 7 días para artifacts

### Linting
- **Herramienta**: ESLint
- **Configuración**: `.eslintrc.cjs`
- **Scripts**: `yarn lint`, `yarn lint:fix`
- **Reglas**: TypeScript + Prettier compatible

### Artifacts Generados
- Reportes de cobertura HTML
- Logs de ejecución
- Resultados de pruebas
- Métricas de rendimiento

## 🚀 Flujo de Trabajo Recomendado

### Para Desarrolladores

1. **Crear Feature Branch**
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

2. **Desarrollo Local**
   ```bash
   yarn install
   yarn build
   yarn test:unit
   yarn test:integration
   ```

3. **Crear Pull Request**
   - Target: `feature/review-docs`
   - Los workflows se ejecutarán automáticamente

4. **Revisar Status Checks**
   - Esperar a que pasen todos los tests
   - Revisar reportes de cobertura
   - Corregir cualquier fallo

5. **Merge**
   - Solo disponible cuando todos los checks pasen
   - Requiere aprobación de reviewer

### Para Administradores

1. **Configurar Branch Protection**
   - Seguir la guía en `branch-protection.md`
   - Configurar status checks requeridos

2. **Monitorear Workflows**
   - Revisar logs de GitHub Actions
   - Verificar reportes de cobertura
   - Ajustar timeouts si es necesario

3. **Mantener Configuración**
   - Actualizar versiones de Node.js
   - Revisar dependencias de seguridad
   - Optimizar tiempos de ejecución

## 🛠️ Troubleshooting

### Problemas Comunes

#### Workflows No Se Ejecutan
- Verificar triggers en el archivo YAML
- Confirmar que la rama esté en la lista de triggers
- Revisar permisos del repositorio

#### Tests Fallan
- Revisar logs detallados en GitHub Actions
- Verificar configuración de Jest
- Confirmar que las dependencias estén actualizadas

#### Coverage No Se Genera
- Verificar que `coverage/lcov.info` se genere
- Confirmar configuración de Jest
- Revisar logs de ejecución de tests

#### Linting Falla
- Verificar configuración de ESLint en `.eslintrc.cjs`
- Confirmar que las dependencias de ESLint estén instaladas
- Revisar reglas específicas que causan errores

#### Timeouts
- Aumentar `timeout-minutes` en el workflow
- Optimizar configuración de Jest
- Considerar paralelización de tests

### Comandos de Debug

```bash
# Verificar configuración local
yarn lint
yarn test:unit --verbose
yarn test:coverage --verbose

# Limpiar cache
yarn cache clean
rm -rf node_modules
yarn install

# Verificar versión de Node.js
node --version
yarn --version

# Ejecutar en Docker (como en CI)
docker build -t midnight-mcp-test .
docker run --rm -v $(pwd):/app -w /app midnight-mcp-test sh -c "yarn install && yarn lint && yarn test:unit"
```

## 📈 Mejoras Futuras

### Optimizaciones Planificadas
- [ ] Paralelización de tests unitarios
- [ ] Cache de dependencias optimizado
- [ ] Tests de seguridad automatizados
- [ ] Análisis de código estático
- [ ] Notificaciones de Slack/Discord

### Monitoreo
- [ ] Dashboard de métricas de CI/CD
- [ ] Alertas de fallos de tests
- [ ] Reportes de rendimiento
- [ ] Análisis de tendencias de cobertura

## 📚 Recursos Adicionales

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [Jest Coverage Documentation](https://jestjs.io/docs/configuration#collectcoveragefrom--arraystring)
- [ESLint Documentation](https://eslint.org/)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

---

*Esta configuración asegura que solo código de alta calidad y bien probado sea integrado a la rama `feature/review-docs`.* 
