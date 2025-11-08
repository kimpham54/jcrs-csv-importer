# JCRS CSV Importer

work will continue to be updated on  https://github.com/dulibrarytech/jcrs-csv-importer

run with npx tsx watch src/server.ts

- A CSV drag and drop app to upload a CSV file of records to a MariaDB database
- blank CSV template: https://denveru-my.sharepoint.com/:x:/r/personal/kim_pham60_du_edu/Documents/JCRS%20Patient%20Record%20Database_Single%20Sheet_Version_036.xlsx%20-%20blank_template.csv?d=wb07285c18e1a4c72b4ea2dbf36b9f901&csf=1&web=1&e=I9qfqx. Field mappings can be adjusted in code
- handle urls can be retrieved from an API endpoint

## setup
npm install

## environment

DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_DATABASE=
DB_TABLE=
BASE_PATH=
PORT=3000

REPO_ENDPOINT=
REPO_IMAGES_ENDPOINT=
REPO_API_KEY=
REPO_HANDLE_URL=
REPO_SIP_UUID=
