import console from "node:console";

// Устанавливаем raw mode для stdin
function setRawMode(enabled: boolean) {
    Deno.stdin.setRaw(enabled);
}

// Функция для отображения меню
function renderMenu(options: string[], selectedIndex: number) {
    // Очищаем предыдущие строки
    for (let i = 0; i < options.length; i++) {
        Deno.stdout.writeSync(new TextEncoder().encode('\x1B[2K\r')); // Очищаем строку
        Deno.stdout.writeSync(new TextEncoder().encode('\x1B[A')); // Перемещаемся на строку назад
    }
    options.forEach((option, index) => {
        if (index === selectedIndex) {
            console.log(`> ${option}`); // Выделяем выбранную опцию
        } else {
            console.log(`  ${option}`);
        }
    });
}

// Основная функция
export async function CommandOptionals(options: string[] = []): Promise<string | undefined> {
    let selectedIndex = 0;

    // Включаем raw mode для stdin
    setRawMode(true);

    // Первоначальный вывод меню
    options.forEach((option, index) => {
        if (index === selectedIndex) {
            console.log(`> ${option}`);
        } else {
            console.log(`  ${option}`);
        }
    });

    while (true) {
        const buf = new Uint8Array(3); // Буфер для чтения (3 байта достаточно для стрелок)
        const n = await Deno.stdin.read(buf); // Читаем ввод
        if (n === null) break; // Если ввод завершен, выходим

        const key = new TextDecoder().decode(buf.subarray(0, n));

        // Обработка нажатий стрелок
        switch (key) {
            case "\x1B[A": // Стрелка вверх
                selectedIndex = Math.max(0, selectedIndex - 1);
                break;
            case "\x1B[B": // Стрелка вниз
                selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
                break;
            case "\r": // Enter
                // Выходим из цикла
                break;
            case "\u0003": // Ctrl+C

                break;
            default:
                // Игнорируем другие клавиши
                continue;
        }

        // Если нажата Enter, выходим из цикла
        if (key === "\r" || key === "\u0003") {
            break;
        }

        // Обновляем меню
        renderMenu(options, selectedIndex);
    }

    // Выключаем raw mode
    setRawMode(false);

    // Возвращаем выбранную опцию
    return options[selectedIndex];
}
/** Берет ввод из строки */
export async function CommandsUserInput(): Promise<string> {
    const buf = new Uint8Array(1024);
    const input = await Deno.stdin.read(buf);

    return new TextDecoder().decode(buf.subarray(0, input!));
}