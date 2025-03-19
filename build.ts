import fs from 'node:fs';
import path from 'node:path';
import process from "node:process";
/**
 * 
 * @param outdir Путь куда копировать
 * @param namefile Название файла из корневого каталога
 */
function copyFileSync(outdir: string, namefile: string) {
    if (fs.existsSync(path.join(process.cwd(), outdir))) {
        fs.copyFileSync(path.join(process.cwd(), namefile), path.join(process.cwd(),  outdir, namefile));
    }
    //Указываем путь куда копировать
}

copyFileSync('build', 'favicon.ico');
copyFileSync('build', 'repo.conf.json');