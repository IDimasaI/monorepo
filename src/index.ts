import process from 'node:process';
import fsP from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { CommandOptionals, CommandsUserInput } from "./TCommand.ts";
enum ValidationResult {
    ALL = 'all',      // Если ввод равен './'
    SOME = 'some',    // Если ввод содержит запятые
    REGEXP = 'regexp', // Если ввод начинается с './' и заканчивается на '$'
    ONE = 'one',      // Если ввод содержит хотя бы одно слово
    INVALID = 'invalid',   // Если ввод пустой или невалидный
}
enum Color {
    Green = '\x1b[32m',
    Yellow = '\x1b[33m',
    Red = '\x1b[31m',
    Stop = '\x1b[0m'
}

class BaseFunctions {
    public getCurrentCWD() {
        return process.cwd();
    }
}

class ActionSave extends BaseFunctions {
    private PATH_ARCHIVE: string
    private config: Config
    private FLAGS: string | undefined

    constructor(config: Config) {
        super();
        if (config.PATH_ARCHIVE == "") {
            config.PATH_ARCHIVE = Deno.execPath().replace(/(\\monor.exe)$/g, '/archive')
            console.log(`PATH_ARCHIVE: ${config.PATH_ARCHIVE.replace(/(\\monor.exe)$/g, '')}`)
        }
        this.PATH_ARCHIVE = config.PATH_ARCHIVE
        this.config = config
    }

    public run(files: string, FLAGS: string | undefined = undefined) {
        try {
            if (!fs.existsSync(this.PATH_ARCHIVE)) {
                fs.mkdirSync(this.PATH_ARCHIVE)
            };
            this.FLAGS = FLAGS
            this.save(files);
        } catch (error) {
            console.log(error);
        }
    }

    public save(files: string) {
        const validateNames = this.validateNames(files);
        switch (validateNames) {
            case ValidationResult.ALL:
                console.log('Обрабатываем случай: ALL');
                this.all();
                break;
            case ValidationResult.SOME:
                console.log('Обрабатываем случай: SOME');
                this.some(files);
                break;
            case ValidationResult.REGEXP:
                console.log('Обрабатываем случай: REGEXP');
                break;
            case ValidationResult.ONE:
                console.log('Обрабатываем случай: ONE');
                this.one(files);
                break;
            case ValidationResult.INVALID:
                console.log('Обрабатываем случай: INVALID');
                break;
            default:
                console.log('Неизвестный результат');
                break;
        }
        return;
    }

    private validateNames(files: string): ValidationResult {
        const trimmedFiles = files?.trim() || '';

        if (trimmedFiles === '') {
            return ValidationResult.INVALID; // если пусто
        }
        if (trimmedFiles === './') {
            return ValidationResult.ALL; // если ./
        }
        if (trimmedFiles.includes(',')) {
            return ValidationResult.SOME; // если есть запятая
        }
        if (/^\.\/.*\$/.test(trimmedFiles)) {
            return ValidationResult.REGEXP; // если начинается с ./ и заканчивается $
        }
        if (/.+/.test(trimmedFiles)) {
            return ValidationResult.ONE; // если есть хоть какое-то слово
        }

        return ValidationResult.INVALID; // если ни одно условие не выполнено
    }

    private all() {
        const currentCWD = this.getCurrentCWD();
        const outdir = this.PATH_ARCHIVE;

        const items = fs.readdirSync(currentCWD, { withFileTypes: true });
        let i: number = 0;
        for (const item of items) {
            const sourcePath = path.join(currentCWD, item.name);
            const destPath = path.join(outdir, item.name);

            if (item.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                this.copySyncRecursive(sourcePath, destPath);
            } else {
                this.copyFileSync(sourcePath, destPath, i);
                i++;
            }
        }
    }


    private some(names: string) {
        const allnames = names.split(',');
        const currentCWD = this.getCurrentCWD();
        const outdir = this.PATH_ARCHIVE;
        let i = 0;
        for (const name of allnames) {
            const namefile = path.join(currentCWD, name);
            if (fs.statSync(namefile).isDirectory()) {
                console.log(`${Color.Yellow}${namefile} не обрабатывается, так как это директория,\n Перечисление не поддерживает обработку полных директорий, только отдельных файлов в них.\n Обрабатывайте папку отдельно.${Color.Stop}`);
                continue;
            }
            this.copyFileSync(namefile, path.join(outdir, path.basename(namefile)), i);
            i++;
        }
    }

    private one(name: string) {
        try {
            const currentCWD = this.getCurrentCWD();
            const outdir = this.PATH_ARCHIVE;
            const namefile = path.join(currentCWD, name);
            if (fs.statSync(namefile).isDirectory()) {
                fs.mkdirSync(path.join(outdir, path.basename(namefile)), { recursive: true });
                this.copySyncRecursive(namefile, path.join(outdir, path.basename(namefile)));
            } else {
                this.copyFileSync(namefile, path.join(outdir, path.basename(namefile)));
            }
        } catch (error) {
            console.log(`${Color.Red}${error}${Color.Stop}`);
        }
    }

    private copyFileSync(sourcePath: string, destPath: string, index: number | undefined = undefined) {
        try {
            if (!this.FLAGS) {
                const groupName = this.testGroup(path.basename(sourcePath));
                if (groupName) {
                    destPath = path.join(this.PATH_ARCHIVE, groupName, path.basename(sourcePath));
                }
            }
            if (!fs.existsSync(destPath)) {
                if (!fs.existsSync(path.dirname(destPath))) {
                    fs.mkdirSync(path.dirname(destPath), { recursive: true });
                }
                fs.copyFileSync(sourcePath, destPath);
                this.updateHashMapFiles(destPath, path.basename(destPath));
                console.log(`${Color.Green}${destPath} создан${Color.Stop}`);
            } else {

                if (this.isUpdateFile(sourcePath, destPath)) {
                    fs.copyFileSync(sourcePath, destPath);
                } else {
                    console.log(`${Color.Yellow}${destPath} не обновлен${Color.Stop}`);
                }
            }
        } catch (error) {
            if (error instanceof Error)
                console.error(`${index ? `${Color.Red}${index}:${Color.Stop}` : ''} ${Color.Red}${error}${Color.Stop}`);
        }
    }

    private testGroup(file: string): string | undefined {
        if (!this.config.Groups) return undefined;
        for (const [groupName, files] of Object.entries(this.config.Groups)) {
            if (files.includes(file)) {
                return groupName;
            }
        }
        return undefined;
    }

    private isUpdateFile(newFile: string, archiveFile: string) {
        try {
            const newStat = fs.statSync(newFile);
            const archiveStat = fs.statSync(archiveFile);
            if (archiveStat.mtime < newStat.mtime) {
                console.log(`${Color.Green}${archiveFile} обновлен, ${this.SizeRange(newStat, archiveStat)}${Color.Stop}`);
                return true
            }
            return false
        } catch (_error) {

            return true
        }
    }

    private SizeRange(newFile: fs.Stats, archiveFile: fs.Stats) {
        const size1 = newFile.size;
        const size2 = archiveFile.size;
        if (size1 < size2) {
            return `${Color.Yellow}${this.SizeFile(archiveFile)}${Color.Green} => ${this.SizeFile(newFile)}`;
        } else {
            return `${Color.Green}${this.SizeFile(archiveFile)}${Color.Yellow} => ${this.SizeFile(newFile)}`
        }
    }

    private SizeFile(file: fs.Stats): string {
        const sizeInBytes = file.size;
        if (sizeInBytes < 1024) {
            return `${sizeInBytes} байт`;
        } else if (sizeInBytes < 1024 * 1024) {
            return `${(sizeInBytes / 1024).toFixed(2)} кб`;
        } else if (sizeInBytes < 1024 * 1024 * 1024) {
            return `${(sizeInBytes / 1024 / 1024).toFixed(2)} мб`;
        } else {
            return `${(sizeInBytes / 1024 / 1024 / 1024).toFixed(2)} гб`;
        }
    }

    private updateHashMapFiles(destPath: string, nameFile: string) {
        if (!fs.existsSync(`${this.config.PATH_ARCHIVE}/hashmap.json`)) {
            fs.writeFileSync(`${this.config.PATH_ARCHIVE}/hashmap.json`, JSON.stringify({ [nameFile]: destPath.replaceAll('\\', '/') }, null, 2));
        } else {
            const json = JSON.parse(fs.readFileSync(`${this.config.PATH_ARCHIVE}/hashmap.json`, 'utf-8'));
            json[nameFile] = destPath.replaceAll('\\', '/');
            fs.writeFileSync(`${this.config.PATH_ARCHIVE}/hashmap.json`, JSON.stringify(json, null, 2));
        }
    }

    private copySyncRecursive(sourceDir: string, destDir: string) {
        const files = fs.readdirSync(sourceDir);
        let i = 0;
        for (const file of files) {
            const sourcePath = path.join(sourceDir, file);
            const destPath = path.join(destDir, file);

            if (fs.statSync(sourcePath).isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                this.copySyncRecursive(sourcePath, destPath);
            } else {
                this.copyFileSync(sourcePath, destPath);
            }
            i++
        }
    }
}

class ActionDelete extends BaseFunctions {
    private config: Config
    constructor(config: Config) {
        super();
        this.config = config;
    }

    public run(files: string, FLAGS: string | undefined = undefined) {
        try {
            this.delete(files, FLAGS);
        } catch (error) {
            if (error instanceof Error)
                console.error(`${Color.Red}${error}${Color.Stop}`);
        }
    }

    private delete(files: string, FLAGS: string | undefined = undefined) {
        let json = JSON.parse(fs.readFileSync(`${this.config.PATH_ARCHIVE}/hashmap.json`, 'utf-8'));
        if (FLAGS !== 'groups' && FLAGS !== '-g') {//Обычное удаление пофайлово
            const filesArray = files.split(',');
            for (const file of filesArray) {
                fs.rmSync(json[file], { recursive: true, force: true });
                json = this.deleteHashMapFiles(file, json);
            }
        }
    }

    private deleteHashMapFiles(file: string, json: { [key: string]: string }) {
        delete json[file];
        fs.writeFileSync(`${this.config.PATH_ARCHIVE}/hashmap.json`, JSON.stringify(json, null, 2));
        return json
    }

}

class ActionGet extends BaseFunctions {
    private config: Config
    constructor(config: Config) {
        super();
        this.config = config;
    }

    public run(files: string, FLAGS: string | undefined = undefined) {
        try {
            this.get(files, FLAGS);
        } catch (error) {
            if (error instanceof Error)
                console.error(`${Color.Red}${error}${Color.Stop}`);
        }
    }

    private get(files: string, FLAGS: string | undefined = undefined) {
        const json = JSON.parse(fs.readFileSync(`${this.config.PATH_ARCHIVE}/hashmap.json`, 'utf-8'));
        if (this.config.Groups && this.config.Groups[files]) {
            const dist = FLAGS ? `${this.getCurrentCWD()}/${FLAGS}` : this.getCurrentCWD();
            console.log(`${Color.Yellow}Группа ${files}${Color.Stop}, загрузка в папку ${Color.Green}${dist}${Color.Stop}`);
            if (!fs.existsSync(`${dist}/${files}`)) {
                fs.mkdirSync(`${dist}/${files}`, { recursive: true });
            }
            for (const file of this.config.Groups[files]) {
                console.log(`> Загрузка ${Color.Green}${file}${Color.Stop}`);
                fs.copyFileSync(json[file], `${dist}/${files}/${file}`);
            }
        } else {
            const dist = FLAGS ? `${this.getCurrentCWD()}/${FLAGS}` : this.getCurrentCWD();
            if (FLAGS) {
                if (!fs.existsSync(dist)) {
                    fs.mkdirSync(dist, { recursive: true });
                }
            }
            console.log(`> Загрузка ${Color.Green}${files}${Color.Stop} в папку ${Color.Green}${dist}${Color.Stop}`);
            fs.copyFileSync(json[files], `${dist}/${files}`);
        }
    }
}

/** Конфиг */
type Config = {
    PATH_ARCHIVE: string;
    Groups?: { [key: string]: string[] };
};

class Monorepo {
    private config: Config = {
        PATH_ARCHIVE: "",
    };

    private ActionSave: ActionSave;
    private ActionDelete: ActionDelete;
    private ActionGet: ActionGet;

    constructor() {
        this.config = JSON.parse(this.findConf());
        this.ActionSave = new ActionSave(this.config);
        this.ActionDelete = new ActionDelete(this.config);
        this.ActionGet = new ActionGet(this.config);
    }

    public getCommands() {
        return process.argv.slice(2);
    }

    public actionSave(files: string, FLAGS: string | undefined = undefined) {
        this.ActionSave.run(files, FLAGS);
    }

    public actionDelete(files: string, FLAGS: string | undefined = undefined) {
        this.ActionDelete.run(files, FLAGS);
    }

    public actionGet(files: string, FLAGS: string | undefined = undefined) {
        this.ActionGet.run(files, FLAGS);
    }

    public help(more: string | null = null) {
        if (!more) {
            console.log(`-h <more> | help <more> - Помощь\n\tinit - Инициализация\n\tsave - Сохранение\n\tconfig - Настройки конфигурации\n\tget - Получить файл или группу файлов\n\tdelete - Удаление файлов из монорепозитория`);
        } else {
            switch (more) {
                case 'init':
                    console.log(`-i | init - Инициализация\n\tСоздает конфиг в текущем каталоге`)
                    break;
                case 'save':
                    console.log(`-s <PATH> <FLAGS> | save <PATH> <FLAGS> - Сохранение\n\t${Color.Green}./${Color.Stop} - Обрабатывает все файлы в текущем каталоге\n\t${Color.Green}file1,file2${Color.Stop} - Обрабатывает указанные файлы\n\t${Color.Red}regexp${Color.Stop} - Обрабатывает все файлы в текущем каталоге, которые соответствуют регулярному выражению\n\t${Color.Green}path${Color.Stop} - Обрабатывает указанный файл, или весь каталог.\n\n\tЕсли в конфиге есть группа и в ней находится файл который будет сохранен, то этот файл будет перенесен в папку с названием группы.\n\tПараметр <FLAGS> -g нужен что-бы указать что сохранять файл без просмотра группы в конфиге.`)
                    break;
                case 'config':
                    console.log(`PATH_ARCHIVE - Путь к репозиторию`)
                    break;
                case 'get':
                    console.log(`-g <Name> <PATH> | get <Name> <PATH> - Получение группы или отдельного файла.\n\t Если в конфиге есть группа, то для нее будет создаватся отдельная папка при получении.\n\t Параметр <PATH> нужен что-бы указать путь из текущего каталога.`);
                    break;
                case 'delete':
                    console.log(`-d <Name> | delete <Name> - Удаление файла из всего монорепозитория.\n\t Настройки конфига не удаляются.`);
                    break;
                default:
                    break;
            }
        }
    }

    public async init(commandVariable: string) {
        if (commandVariable == 'base') {
            console.log('base');
            fs.writeFileSync(path.join(process.cwd(), 'repo.conf.json'), JSON.stringify(this.config, null, 2));
        } else if (commandVariable == 'custom') {
            console.log(`Введите путь к репозиторию: `);
            const PATH_ARCHIVE = await CommandsUserInput();
            const config = {
                PATH_ARCHIVE: PATH_ARCHIVE.replace('\\', '/').replace(/\r\n/, '')
            };
            fs.writeFileSync(path.join(process.cwd(), 'repo.conf.json'), JSON.stringify(config, null, 2));
        }

    }

    private findConf(currentDirs?: string): string {
        try {
            let currentDir = currentDirs || process.cwd();
            if (fs.existsSync(path.join(currentDir, 'repo.conf.json'))) {
                return fs.readFileSync(path.join(currentDir, 'repo.conf.json'), 'utf-8');
            } else {
                currentDir = path.dirname(currentDir);
                return this.findConf(currentDir);
            }
        } catch (_error) {
            return JSON.stringify(this.config);
        }
    }

}
async function run() {
    const monorepo = new Monorepo();
    const [commands, comands1, FLAGS] = monorepo.getCommands();

    if (commands == 'help' || commands == '-h') {
        monorepo.help(comands1);
    }

    if (commands == 'init' || commands == '-i') {
        const commandVariable = await CommandOptionals(["base", "custom", "Выход"]);
        if (commandVariable == 'Выход') return;
        monorepo.init(commandVariable!);
    }

    if (commands == 'save' || commands == '-s') {
        monorepo.actionSave(comands1, FLAGS)
    }

    if (commands == 'delete' || commands == '-d') {
        monorepo.actionDelete(comands1, FLAGS)
    }

    if (commands == 'get' || commands == '-g') {
        monorepo.actionGet(comands1, FLAGS)
    }

}


await run();