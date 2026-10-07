# Vote to Impress

Copia privada del proyecto. Incluye el código, las pantallas, las migraciones de la base de datos y las imágenes de `public/media`.

No incluye cuentas ni votos de la vista previa, ni la contraseña de la base de datos de producción. Esas no viven en el código.

## Arrancar en local

```bash
npm install
npm run dev
```

La vista local usa una base de datos temporal. Para un sitio propio hace falta un Postgres y las variables que inyecta el alojamiento (`DATABASE_URL`, secreto de sesión y, si se usan, las claves de Google y X).
