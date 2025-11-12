import { world, system, ItemStack, EquipmentSlot, EasingType, InputPermissionCategory, Player } from "@minecraft/server";
import * as Vec3 from 'utils/vec3.js'


import "item_components.js"




function parseOre(id) {
    const [namespace, name] = id.split(":");
    if (!name) return id; // Si no tiene nombre, devolvemos tal cual

    // Si es un ore (incluyendo deepslate), convertir a raw_<base>
    const oreMatch = name.match(/^(deepslate_)?(.+)_ore$/);
    if (oreMatch) {
        const base = oreMatch[2];
        return `${namespace}:raw_${base}`;
    }

    // Si es un raw_<base>, convertir a <base>_ingot
    if (name.startsWith("raw_")) {
        const base = name.replace(/^raw_/, "");
        return `${namespace}:${base}_ingot`;
    }

    //return id
    return "unknown";
}


function shootProjectile(projectileId, dimension, location, direction, { source, velocityMultiplier = 1, uncertainty = 0 }) {
    const velocity = {
        x: direction.x * velocityMultiplier,
        y: direction.y * velocityMultiplier,
        z: direction.z * velocityMultiplier,
    };

    const projectile = dimension.spawnEntity(projectileId, location);
    const projectileComp = projectile.getComponent('minecraft:projectile');

    projectileComp?.shoot(velocity, {
        uncertainty,
    });

    if (source) {
        projectileComp.owner = source;
    }
}


const NEONITE_PICKAXE_ID = "stellar:neonite_pickaxe";

world.afterEvents.playerBreakBlock.subscribe(event => {
    const player = event.player;
    const block = event.brokenBlockPermutation;
    const equippable = player.getComponent("minecraft:equippable");
    const item = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
    const block1 = event.block;


    if (!item || item.typeId !== NEONITE_PICKAXE_ID) return;

    const blockId = block.type.id;
    let smeltResultId = null;

    if (blockId === "minecraft:iron_ore" || blockId === "minecraft:deepslate_iron_ore") {
        smeltResultId = "minecraft:iron_ingot";
    } else if (blockId === "minecraft:gold_ore" || blockId === "minecraft:deepslate_gold_ore") {
        smeltResultId = "minecraft:gold_ingot";
    } else if (blockId === "minecraft:copper_ore" || blockId === "minecraft:deepslate_copper_ore") {
        smeltResultId = "minecraft:copper_ingot";
    }

    if (smeltResultId) {
        // Dar el lingote directamente al jugador


        const dimension = player.dimension;
        const oreItems = dimension.getEntities({ type: "minecraft:item", location: block1.location, maxDistance: 1.5 })

        oreItems.forEach(oreItem => {
            const rawOre = oreItem.getComponent("item").itemStack
            //aqui validamos si existe un ore crudo del bloque minado

            //world.sendMessage(parseOre(blockOre) + " " + rawOre.typeId)
            if (parseOre(block.type.id) != rawOre.typeId) { return; }
            const ingotOre = new ItemStack(parseOre(rawOre.typeId))

            dimension.spawnItem(ingotOre, oreItem.location)
            oreItem.remove()

            //console.warn(rawOre.typeId)
        })

        // ✨ Partículas + 🔊 Sonido
        const { x, y, z } = event.block.location;
        system.runTimeout(() => {
            player.runCommand(`particle minecraft:endrod ${x} ${y + 1} ${z}`);
            player.runCommand(`particle minecraft:enchanting_table_particle ${x} ${y + 0.5} ${z}`);
            player.runCommand(`playsound random.anvil_use @a ${x} ${y} ${z} 1 1.2`);
        }, 2);
    }
});


const NEONITE_SWORD_ID = "stellar:neonite_sword";

const SPECIAL_COOLDOWN = 5000; // ⏳ 5 segundos de cooldown
const DASH_FORCE = 2.5;       // 🚀 Velocidad del dash
const ATTACK_RADIUS = 3;      // 📍 Radio de daño en el dash
const DASH_DAMAGE = 10;       // 💥 Daño que hace el dash
const playerCooldowns = new Map();


world.afterEvents.entityHitEntity.subscribe(event => {
    const player1 = event.damagingEntity;
    const target1 = event.hitEntity;

    // Verificamos que el atacante es jugador
    if (!player1?.getComponent) return;

    const item = player1.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (!item || item.typeId !== NEONITE_SWORD_ID) return;

    // ✨ Partículas futuristas al golpear

    // 💪 Efecto al jugador (fuerza + velocidad breve)

    player1.addEffect("strength", 40, { amplifier: 3, showParticles: false });
    player1.addEffect("speed", 40, { amplifier: 2, showParticles: false });
});


world.beforeEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (!item || item.typeId !== NEONITE_SWORD_ID) return;

    const now = Date.now();
    const lastUse = playerCooldowns.get(player.id) || 0;

    if (now - lastUse < SPECIAL_COOLDOWN) {
        const secondsLeft = ((SPECIAL_COOLDOWN - (now - lastUse)) / 1000).toFixed(1);
        player.sendMessage(`§c⚠ Ataque especial disponible en ${secondsLeft}s`);
        return;
    }

    playerCooldowns.set(player.id, now);

    // 📍 Dirección a donde mira el jugador
    const direction = player.getViewDirection();

    const horizontalForce = { x: 4, z: 4 }; // horizontal knockback strength - xz vector
    const verticalStrength = 0.3;           // upward knockback strength


    // ✨ Efectos visuales del dash
    const { x, y, z } = player.location;
    system.runTimeout(() => {
        player.runCommand(`particle minecraft:endrod ${x} ${y + 1} ${z}`);
        player.runCommand(`particle minecraft:sonic_explosion_emitter ${x} ${y + 1} ${z}`);
        player.runCommand(`playsound mob.enderdragon.flap @a ${x} ${y} ${z} 1 1.3`);
    }, 2);



    // 🚀 Empuje tipo dash (anime)

    // 💥 Daño en área frente al jugador (ligeramente después del dash)
    system.runTimeout(() => {
        const dimension = player.dimension;
        const playerPos = player.location;

        for (const entity of dimension.getEntities({ maxDistance: ATTACK_RADIUS, location: playerPos })) {
            if (entity.id !== player.id && entity.typeId !== "minecraft:item") {
                entity.applyDamage(DASH_DAMAGE, { cause: "entityAttack", damagingEntity: player });
            }
        }

        const direction = player.getViewDirection(); // Vector unitario (x, y, z)
        const force = 2.5; // Ajusta la fuerza del impulso

        player.applyImpulse({
            x: direction.x * force,
            y: direction.y * force * 0.3, // Un poco de elevación opcional
            z: direction.z * force
        });

        // 💪 Buff corto al jugador
        player.addEffect("strength", 60, { amplifier: 2, showParticles: false });
        player.addEffect("speed", 60, { amplifier: 2, showParticles: false });

        player.sendMessage("§b⚡ ¡Ataque especial activado!");
    }, 8); // pequeño delay para que golpee después de moverse
});

const BONUS_XP = 20; // 🔮 cantidad de experiencia extra al matar

// 🎯 Cuando una entidad muere
world.afterEvents.entityDie.subscribe(event => {
    const { deadEntity, damageSource } = event;
    if (!damageSource || !damageSource.damagingEntity) return;

    const player = damageSource.damagingEntity;
    if (!player || player.typeId !== "minecraft:player") return;

    const held = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (!held || held.typeId !== NEONITE_SWORD_ID) return;

    // 🔥 Otorga experiencia directamente al jugador
    try {
        player.addExperience(BONUS_XP);
    } catch (e) {
        console.warn("No se pudo otorgar XP directamente:", e);
    }

    // 💫 Efectos visuales opcionales
    const dim = player.dimension;
    const { x, y, z } = deadEntity.location;

    try {
        dim.runCommand(`particle minecraft:happy_villager ${x} ${y + 1} ${z}`);
        dim.runCommand(`playsound random.orb @a ${x} ${y} ${z} 1 1.3`);
    } catch { }

    // Mensaje de confirmación
    player.sendMessage(`§a+${BONUS_XP} ⚡ Neonite Energy absorbed!`);
});


const NEONITE_ARMOR_IDS = {
    head: "stellar:neonite_armor_helmet",
    chest: "stellar:neonite_armor_chestplate",
    legs: "stellar:neonite_armor_leggings",
    feet: "stellar:neonite_armor_boots"
};

// ✨ Efectos de la armadura de Neonita
function applyNeoniteArmorEffects(player) {
    player.addEffect("strength", 40, { amplifier: 3, showParticles: false });
    player.addEffect("resistance", 40, { amplifier: 3, showParticles: false });
    player.addEffect("regeneration", 40, { amplifier: 2, showParticles: false });
    player.addEffect("speed", 40, { amplifier: 2, showParticles: false });
    player.addEffect("night_vision", 220, { amplifier: 0, showParticles: false });
    // 220 ticks = 11 s → la renovamos antes de que se acabe para evitar parpadeo
}

// 🧰 Verificar set completo
function hasFullNeoniteArmor(player) {
    const eq = player.getComponent("minecraft:equippable");
    if (!eq) return false;

    return (
        eq.getEquipment(EquipmentSlot.Head)?.typeId === NEONITE_ARMOR_IDS.head &&
        eq.getEquipment(EquipmentSlot.Chest)?.typeId === NEONITE_ARMOR_IDS.chest &&
        eq.getEquipment(EquipmentSlot.Legs)?.typeId === NEONITE_ARMOR_IDS.legs &&
        eq.getEquipment(EquipmentSlot.Feet)?.typeId === NEONITE_ARMOR_IDS.feet
    );
}

// Guardamos estado de vuelo por jugador
const flyingState = new Map(); // player.id → true/false

// 🚫 Cancelar daño por caída si lleva la armadura
world.afterEvents.entityHurt.subscribe((event) => {
    const { damageSource, hurtEntity, damage } = event;

    if (hurtEntity.typeId !== "minecraft:player") return;
    if (damageSource.cause !== "fall") return;
    if (!hasFullNeoniteArmor(hurtEntity)) return;

    // 🔄 Revertir el daño inmediatamente
    const health = hurtEntity.getComponent("minecraft:health");
    if (health) {
        const current = health.currentValue;
        const max = health.effectiveMax;
        const newHealth = Math.min(current + damage, max);
        health.setCurrentValue(newHealth);
    }

    // ✨ Pequeño efecto visual
    const { x, y, z } = hurtEntity.location;
    hurtEntity.runCommand(`particle minecraft:sonic_explosion_emitter ${x} ${y} ${z}`);
});

// 🌀 Loop principal cada 5 ticks (0.25 s)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const fullSet = hasFullNeoniteArmor(player);

        if (!fullSet) {
            player.removeEffect("levitation");
            flyingState.delete(player.id);
            continue;
        }

        // Aplicar efectos base (visión nocturna, fuerza, etc.)
        applyNeoniteArmorEffects(player);

        const isSneaking = player.isSneaking;
        const isFlying = flyingState.get(player.id) === true;

        if (isSneaking) {
            // 🕊 Mantener vuelo mientras esté agachado
            player.addEffect("levitation", 10, { amplifier: 1, showParticles: false }); // se renueva cada 5 ticks

            if (!isFlying) {
                flyingState.set(player.id, true);

                // 🌟 Efectos visuales y sonido solo al despegar
                const { x, y, z } = player.location;
                player.runCommand(`particle minecraft:endrod ${x} ${y - 0.5} ${z}`);
                player.runCommand(`particle minecraft:enchanting_table_particle ${x} ${y - 0.2} ${z}`);
                player.runCommand(`playsound mob.enderdragon.flap @a ${x} ${y} ${z} 1 1.2`);
            }
        } else if (isFlying) {
            // 🧨 Aterriza cuando deja de agacharse
            const { x, y, z } = player.location;
            system.runTimeout(() => {
                player.runCommand(`particle minecraft:sonic_explosion_emitter ${x} ${y} ${z}`);
                player.runCommand(`playsound random.explode @a ${x} ${y} ${z} 1 1.5`);
            }, 1);

            player.removeEffect("levitation");
            flyingState.set(player.id, false);
        }
    }
}, 5);


const BLUE_PLATE = "stellar:neonite_blue_plate";
const ORANGE_PLATE = "stellar:neonite_orange_plate";
const DATA_KEY = "stellar:portal_data"; // clave del dynamic property

let platePositionsByDim = {}; // memoria temporal

// --- Cargar desde Dynamic Property ---
function loadPlates() {
    try {
        const data = world.getDynamicProperty(DATA_KEY);
        if (data) {
            platePositionsByDim = JSON.parse(data);
            world.sendMessage("§a✔ Coordenadas de portales restauradas correctamente.");
        } else {
            platePositionsByDim = {};
        }
    } catch (e) {
        console.error("Error al cargar coordenadas:", e);
        platePositionsByDim = {};
    }
}

// --- Guardar en Dynamic Property ---
function savePlates() {
    try {
        world.setDynamicProperty(DATA_KEY, JSON.stringify(platePositionsByDim));
    } catch (e) {
        console.error("Error al guardar coordenadas:", e);
    }
}

// --- Asegura que cada dimensión tenga su registro ---
function ensureDimRecord(dim) {
    const id = dim?.id ?? "unknown";
    if (!platePositionsByDim[id]) {
        platePositionsByDim[id] = { blue: null, orange: null };
    }
    return platePositionsByDim[id];
}

// --- Teletransporte con efectos ---
function teleportPlayerTo(player, targetLocation) {
    if (!targetLocation) return;
    const dim = player.dimension;
    const tx = targetLocation.x + 0.5;
    const ty = targetLocation.y + 1;
    const tz = targetLocation.z + 0.5;

    const px = player.location.x;
    const py = player.location.y;
    const pz = player.location.z;

    player.runCommand(`particle minecraft:portal_reverse_particle ${px} ${py + 1} ${pz}`);
    player.runCommand(`playsound mob.enderman.portal @a ${px} ${py} ${pz} 1 1.5`);

    player.teleport({ x: tx, y: ty, z: tz }, dim);
    player.runCommand(`particle minecraft:portal_reverse_particle ${tx} ${ty} ${tz}`);
}

// --- Carga inicial (al iniciar el script) ---
system.runTimeout(() => {
    loadPlates();
}, 20); // 1 segundo después de cargar el mundo

// --- Bucle principal ---
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const dim = player.dimension;
        const dimRecord = ensureDimRecord(dim);

        const blockUnder = dim.getBlock({
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y - 0.5),
            z: Math.floor(player.location.z)
        });

        if (!blockUnder) continue;
        const id = blockUnder.typeId;

        // Guardar coordenadas
        if (id === BLUE_PLATE) {
            dimRecord.blue = blockUnder.location;
            savePlates();
        } else if (id === ORANGE_PLATE) {
            dimRecord.orange = blockUnder.location;
            savePlates();
        }

        // Teletransportes
        if (id === BLUE_PLATE && dimRecord.orange) {
            teleportPlayerTo(player, dimRecord.orange);
        } else if (id === ORANGE_PLATE && dimRecord.blue) {
            teleportPlayerTo(player, dimRecord.blue);
        }
    }
}, 6);

const NEONITE_CREEPER_ID = "stellar:neonite_creeper";

world.beforeEvents.explosion.subscribe(event => {
    const source = event.source;
    if (!source || source.typeId !== NEONITE_CREEPER_ID) return;

    const dimension = source.dimension;
    const creeperLoc = source.location;

    const nearbyPlayers = dimension.getPlayers({ location: creeperLoc, maxDistance: 6 });
    if (nearbyPlayers.length === 0) return;

    for (const player of nearbyPlayers) {
        for (let i = 0; i < 10; i++) { // hasta 10 intentos de encontrar espacio seguro
            const randomX = player.location.x + (Math.random() * 50 - 5);
            const randomY = player.location.y + (Math.random() * 5 - 2);
            const randomZ = player.location.z + (Math.random() * 10 - 5);

            const block = dimension.getBlock({
                x: Math.floor(randomX),
                y: Math.floor(randomY),
                z: Math.floor(randomZ)
            });
            const blockAbove = dimension.getBlock({
                x: Math.floor(randomX),
                y: Math.floor(randomY + 1),
                z: Math.floor(randomZ)
            });

            // ✅ Solo se teletransporta si ambos bloques son aire
            if (block?.isAir && blockAbove?.isAir) {
                system.runTimeout(() => {
                    try {
                        player.teleport({ x: randomX, y: randomY, z: randomZ }, { dimension: player.dimension });
                    } catch { }
                }, 5);
                break;
            }
        }
    }
});


world.afterEvents.itemCompleteUse.subscribe(ev => {

    const { itemStack, source, useDuration } = ev
    if (itemStack.typeId == "stellar:neonite_red_apple") {
        source.addEffect("speed", 2400, { showParticles: true, amplifier: 3 })
        source.addEffect("strength", 2400, { showParticles: true, amplifier: 3 })
        source.addEffect("fire_resistance", 2400, { showParticles: true, amplifier: 3 })
    }
    else if (itemStack.typeId == "stellar:neonite_blue_apple") {
        source.addEffect("absorption", 2400, { showParticles: true, amplifier: 1 });
        source.addEffect("night_vision", 2400, { showParticles: true, amplifier: 1 });
        source.addEffect("regeneration", 2400, { showParticles: true, amplifier: 1 });
    }
})


const NEONITE_BLOCK_ID = "stellar:neonite_ore";
const NEONITE_COMPASS_ID = "stellar:neonite_locator";

// Detectar cuando el jugador usa la brújula
world.beforeEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;
    if (!player || !item) return;
    if (item.typeId !== NEONITE_COMPASS_ID) return;

    const nearest = findNearestNeonite(player);

    if (nearest) {
        const { x, y, z, distance } = nearest;
        player.sendMessage(`§b🧭 Neonite detected at §fX:${x} Y:${y} Z:${z} §7(${distance.toFixed(1)} blocks away)`);
        player.playSound("random.orb");
    } else {
        player.sendMessage("§c❌ No Neonite block found nearby!");
    }
});

function findNearestNeonite(player, radius = 20) {
    const dim = player.dimension;
    const { x, y, z } = player.location;

    let nearest = null;
    let minDist = Infinity;

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const bx = Math.floor(x + dx);
                const by = Math.floor(y + dy);
                const bz = Math.floor(z + dz);

                const block = dim.getBlock({ x: bx, y: by, z: bz });
                if (!block) continue;
                if (block.typeId === NEONITE_BLOCK_ID) {
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = { x: bx, y: by, z: bz, distance: dist };
                    }
                }
            }
        }
    }

    return nearest;
}

const OVERCHARGER_ID = "stellar:neonite_overcharger";

world.afterEvents.itemUse.subscribe(event => {
    const { source, itemStack } = event;
    if (!source || !itemStack) return;
    if (itemStack.typeId !== OVERCHARGER_ID) return;

    const player = source;
    const dim = player.dimension;
    const viewDir = player.getViewDirection();

    // 🔥 Solo dirección horizontal (XZ)
    const dirX = viewDir.x;
    const dirZ = viewDir.z;

    const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const nx = dirX / length;
    const nz = dirZ / length;

    // 📏 Detecta la altura del suelo debajo del jugador
    const belowBlock = dim.getBlock({
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y) - 1,
        z: Math.floor(player.location.z)
    });

    // Usa esa altura como referencia
    const groundY = belowBlock ? belowBlock.location.y + 1 : Math.floor(player.location.y - 1);

    // 🔥 Crea una línea horizontal de 5 bloques al frente del jugador
    for (let i = 1; i <= 5; i++) {
        const fireX = Math.floor(player.location.x + nx * i);
        const fireY = groundY;
        const fireZ = Math.floor(player.location.z + nz * i);

        const block = dim.getBlock({ x: fireX, y: fireY, z: fireZ });
        const below = dim.getBlock({ x: fireX, y: fireY - 1, z: fireZ });

        if (block && below && block.isAir && !below.isAir) {
            try {
                block.setType("minecraft:fire");
            } catch { }
        }
    }
});


system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const item = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");

        if (item && item.typeId === OVERCHARGER_ID) {
            // Aplica resistencia al fuego constantemente (renueva cada 2 seg)
            player.addEffect("fire_resistance", 40, { amplifier: 0, showParticles: false });
        }
    }
}, 20);

const NEONITE_AXE_ID = "stellar:neonite_axe"; // ajusta a tu id

function isLogBlockById(id) {
    if (!id) return false;
    return id.includes("log") || id.includes("stem");
}

function breakConnectedLogsWithDrops(dimension, startPos, visited = new Set()) {
    const key = `${startPos.x},${startPos.y},${startPos.z}`;
    if (visited.has(key)) return;
    visited.add(key);

    const blk = dimension.getBlock(startPos);
    const typeId = blk?.typeId ?? "";

    if (!isLogBlockById(typeId)) return;

    // Guardamos tipo antes de borrar
    try {
        // Extraer la posible item id del mismo nombre (usualmente coincide)
        const itemId = typeId; // ej. "minecraft:oak_log" -> item "minecraft:oak_log"
        // Quitar el bloque
        blk.setType("minecraft:air");
        // Generar drop (1 por bloque)
        try {
            const drop = new ItemStack(itemId, 1);
            dimension.spawnItem(drop, { x: startPos.x + 0.5, y: startPos.y + 0.5, z: startPos.z + 0.5 });
        } catch (e) {
            // si no pudo crear ItemStack por motivo X, solo seguimos
            console.warn("No se pudo spawnItem:", e);
        }
    } catch (e) {
        console.warn("Error al setType air:", e);
        return;
    }

    const neighbors = [
        { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
        { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
        { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 },
        { dx: 1, dy: 1, dz: 0 }, { dx: -1, dy: 1, dz: 0 },
        { dx: 0, dy: 1, dz: 1 }, { dx: 0, dy: 1, dz: -1 }
    ];

    for (const n of neighbors) {
        const pos = { x: startPos.x + n.dx, y: startPos.y + n.dy, z: startPos.z + n.dz };
        const adj = dimension.getBlock(pos);
        if (adj && isLogBlockById(adj.typeId)) breakConnectedLogsWithDrops(dimension, pos, visited);
    }
}

world.beforeEvents.playerBreakBlock.subscribe(event => {
    const player = event.player;
    const block = event.block; // bloque objetivo (antes de romper)
    if (!player || !block) return;

    const held = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (!held || held.typeId !== NEONITE_AXE_ID) return;

    // Solo si está agachado
    if (!player.isSneaking) return;

    const typeId = block.typeId ?? "";
    if (!isLogBlockById(typeId)) return;

    // debug
    console.warn("Treecapitator triggered (before break). Block:", typeId, "at", block.location);

    // Cancelamos el rompimiento normal y hacemos el treecap
    event.cancel = true;

    // Ejecutar con un pequeño delay para evitar conflictos con el motor
    system.runTimeout(() => {
        const startPos = { x: Math.floor(block.location.x), y: Math.floor(block.location.y), z: Math.floor(block.location.z) };
        breakConnectedLogsWithDrops(player.dimension, startPos);
    }, 1);
});


const ARBOR_CORE_ID = "stellar:arbor_core";

// 🌱 Lista de tipos de árboles posibles
const TREE_TYPES = [
    "oak",
    "birch",
    "spruce",
    "jungle",
    "acacia",
    "dark_oak"
];

// 📦 Evento al usar el Arbor Core
world.afterEvents.itemUse.subscribe(event => {
    const { source: player, itemStack } = event;
    if (!player || !itemStack) return;
    if (itemStack.typeId !== ARBOR_CORE_ID) return;

    const dim = player.dimension;
    const pos = player.location;

    // 📍 Coordenadas frente al jugador
    const dir = player.getViewDirection();
    const x = Math.floor(pos.x + dir.x * 2);
    const y = Math.floor(pos.y);
    const z = Math.floor(pos.z + dir.z * 2);

    // 🌳 Tipo de árbol aleatorio
    const treeType = TREE_TYPES[Math.floor(Math.random() * TREE_TYPES.length)];

    // 🪄 Generar árbol
    try {
        dim.runCommand(`setblock ${x} ${y} ${z} minecraft:${treeType}_sapling`);
        dim.runCommand(`playsound random.levelup @a ${x} ${y} ${z} 1 1.2`);
        player.sendMessage(`§a🌳 Un árbol de tipo §l${treeType}§r ha brotado!`);
    } catch {
        player.sendMessage("§c⚠ No se pudo plantar el árbol aquí.");
    }

    // 🌟 Partículas visuales
    system.runTimeout(() => {
        dim.runCommand(`particle minecraft:happy_villager ${x} ${y + 1} ${z}`);
        dim.runCommand(`particle minecraft:crop_growth_emitter ${x} ${y + 1} ${z}`);
    }, 2);
});


const STABILIZER_ID = "stellar:neonite_stabilizer";
const PLATFORM_BLOCK = "stellar:neonite_block";
const PLATFORM_LIFETIME = 200; // 10 segundos (20 ticks por segundo)

world.afterEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (!item || item.typeId !== STABILIZER_ID) return;

    const dimension = player.dimension;
    const playerY = Math.floor(player.location.y - 1);

    // Verifica si el jugador está en el aire
    const blockBelow = dimension.getBlock({
        x: Math.floor(player.location.x),
        y: playerY,
        z: Math.floor(player.location.z)
    });

    if (blockBelow && blockBelow.typeId !== "minecraft:air") {
        player.sendMessage("§7You must be in the air to use the Neonite Stabilizer.");
        return;
    }

    // 📦 Crear plataforma 3x3 debajo del jugador
    const px = Math.floor(player.location.x);
    const pz = Math.floor(player.location.z);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const blockPos = { x: px + dx, y: playerY, z: pz + dz };
            const block = dimension.getBlock(blockPos);
            if (block && block.typeId === "minecraft:air") {
                block.setType(PLATFORM_BLOCK);

                // ⏳ Programar para eliminar el bloque después de 10 segundos
                system.runTimeout(() => {
                    const b = dimension.getBlock(blockPos);
                    if (b && b.typeId === PLATFORM_BLOCK) {
                        b.setType("minecraft:air");
                    }
                }, PLATFORM_LIFETIME);
            }
        }
    }

    player.runCommand(`playsound random.pop @a[r=10] ${player.location.x} ${player.location.y} ${player.location.z} 1 1`);
    player.sendMessage("§b⚡ A Neonite platform has formed beneath you!");
});

world.afterEvents.projectileHitEntity.subscribe(event => {
    const projectile = event.projectile;
    if (!projectile) return;

    // Verificamos que sea nuestro proyectil personalizado
    if (projectile.typeId === "stellar:custom_waterball") {
        const hit = event.getEntityHit();
        if (!hit || !hit.entity) return;

        const hitEntity = hit.entity;

        try {
            // 🌊 Efectos relacionados al agua
            hitEntity.addEffect("slowness", 120, {
                amplifier: 3, // como si estuviera en el agua
                showParticles: true
            });
            hitEntity.addEffect("levitation", 120, {
                amplifier: 1,
                showParticles: false
            });

            hitEntity.addEffect("weakness", 120, {
                amplifier: 1,
                showParticles: false
            });

            hitEntity.addEffect("nausea", 60, {
                amplifier: 1,
                showParticles: false
            });

            // 💦 Si el enemigo no es acuático, también simular que se ahoga
            hitEntity.addEffect("water_breathing", 60, {
                amplifier: 0,
                showParticles: false
            });

            // 💧 Partículas de salpicadura
            const { x, y, z } = hitEntity.location;
            hitEntity.dimension.runCommand(
                `particle minecraft:splash_particle ${x} ${y + 1} ${z}`
            );
            hitEntity.dimension.runCommand(
                `particle minecraft:bubble_column_up_particle ${x} ${y + 0.5} ${z}`
            );
            hitEntity.dimension.runCommand(
                `particle minecraft:falling_water ${x} ${y + 1.2} ${z}`
            );

            // 🔊 Sonidos de impacto acuático
            hitEntity.dimension.runCommand(
                `playsound random.splash @a[r=16] ${x} ${y} ${z} 1 1`
            );
            hitEntity.dimension.runCommand(
                `playsound mob.guardian.flop @a[r=16] ${x} ${y} ${z} 0.8 1`
            );

            // 💥 Eliminar proyectil tras el impacto
            projectile.remove();

        } catch (error) {
            console.warn("❌ Error aplicando efectos de agua:", error);
        }
    }
});



system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const item = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
        if (!item) continue;

        // Verifica si el jugador sostiene el Neonite Aqua Stepper
        if (item.typeId === "stellar:neonite_aqua_stepper") {
            const { x, y, z } = player.location;
            const bx = Math.floor(x);
            const by = Math.floor(y - 1);
            const bz = Math.floor(z);

            // Congela un área de 3x3 debajo del jugador
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const block = player.dimension.getBlock({ x: bx + dx, y: by, z: bz + dz });
                    if (!block) continue;

                    // Si es agua, conviértelo temporalmente en hielo
                    if (block.typeId === "minecraft:water") {
                        block.setType("minecraft:ice");

                        // Revertir a agua después de 10 segundos
                        system.runTimeout(() => {
                            const check = player.dimension.getBlock({ x: bx + dx, y: by, z: bz + dz });
                            if (check && check.typeId === "minecraft:ice") {
                                check.setType("minecraft:water");
                            }
                        }, 200);
                    }
                }
            }

            // Aplicar velocidad nivel 5 por 1 segundo (se renueva constantemente)
            player.addEffect("minecraft:speed", 20, { amplifier: 4, showParticles: false });
        }
        else if (item.typeId === "stellar:neonite_hydrosphere") {
            // Da respiración bajo el agua y velocidad acuática
            player.addEffect("minecraft:water_breathing", 40, { amplifier: 0, showParticles: false });
            player.addEffect("minecraft:speed", 40, { amplifier: 1, showParticles: false });
        }
    }

}, 2); // Ejecuta cada 0.1 segundos (2 ticks)

const activePlayers = new Set(); // Evita reactivaciones simultáneas

// 💫 Intervalo global que mantiene las partículas de todos los jugadores con el tag "hakari_aura"
system.runInterval(() => {
    const players = world.getAllPlayers();

    for (const player of players) {
        if (player.hasTag("hakari_aura")) {
            player.dimension.spawnParticle("stellar:hakari_aura_emitter", {
                x: player.location.x,
                y: player.location.y + 1,
                z: player.location.z
            });
        }
    }
}, 2); // cada 0.1 segundos

// 🚪 Cuando un jugador entra, se limpia cualquier tag viejo
world.afterEvents.playerSpawn.subscribe(event => {
    const player = event.player;
    system.runTimeout(() => {
        player.removeTag("hakari_aura");
    }, 10);
});

// 🎯 Activación del ítem
world.afterEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || !item) return;
    if (item.typeId !== "stellar:jackpot_shield") return;

    // 🚫 Evita reactivaciones simultáneas
    if (activePlayers.has(player.name)) {
        player.sendMessage("§cThe JackPot Shield is already active!");
        return;
    }

    activePlayers.add(player.name);

    // 🟢 Agrega el tag para activar el aura
    player.addTag("hakari_aura");

    // 🔊 Sonido personalizado
    player.playSound("stellar.hakari_jackpot");

    player.playAnimation("animation.hakari_dance")

    // 🗨️ Mensajes narrativos progresivos
    player.sendMessage(`§b${player.name}§r never acquired Reverse Cursed Technique...`);
    system.runTimeout(() => {
        player.sendMessage(`§7...but the infinite cursed energy overflowing in §b${player.name}'s§r body caused its body to reflexively perform reverse cursed technique in order to not take damage.`);
    }, 80); // 4 segundos
    system.runTimeout(() => {
        player.sendMessage(`§aIn other words, for 4 minutes and 11 seconds following a Jackpot, §b${player.name}§r is effectively §lIMMORTAL§r.`);
    }, 300); // 15 segundos

    const immortalityDuration = 5020; // 2 min 11 seg aprox (en ticks)

    // ❤️ Mantiene al jugador con vida completa mientras esté activo
    const healLoop = system.runInterval(() => {
        if (!activePlayers.has(player.name)) return;
        if (player.isValid()) {
            const healthComp = player.getComponent("minecraft:health");
            if (healthComp) healthComp.currentValue = healthComp.defaultValue;
        }
    }, 2);

    // ✨ Efectos de inmortalidad
    player.addEffect("minecraft:resistance", immortalityDuration, { amplifier: 255, showParticles: false });
    player.addEffect("minecraft:regeneration", immortalityDuration, { amplifier: 10, showParticles: false });

    // ⏳ Cuando termina el efecto, limpiamos todo
    system.runTimeout(() => {
        activePlayers.delete(player.name);
        player.removeTag("hakari_aura"); // ❌ Quita el aura
        system.clearRun(healLoop);
        player.sendMessage("§cThe Jackpot effect has ended...");
    }, immortalityDuration);
});


world.afterEvents.itemUse.subscribe(ev => {
    const player = ev.source;
    const item = ev.itemStack;
    if (!player || !item) return;
    if (item.typeId !== "stellar:neonite_flysup") return;

    // SI ESTÁ EN PRE-CHARGE (animación inicial) → no dejar usar nada
    if (player.hasTag("sup_fly_precharge")) return;

    // PRIMERA VEZ → activar SUPER VUELO
    if (!player.hasTag("sup_fly_active")) {

        player.addTag("sup_fly_precharge"); // evita spam durante anim

        // mensajes iniciales
        player.sendMessage("§a Hey buddy");
        system.runTimeout(() => {
            player.sendMessage("§a Eyes up here.");

        }, 20);

        // sonido inicial (solo 1 vez)
        player.playSound("stellar.superman_flight");

        // animación de inicio
        player.playAnimation("animation.supermanflight");

        // DESPUÉS de que la anim avance → impulsarlo hacia arriba
        system.runTimeout(() => {
            player.dimension.spawnParticle("stellar:super_jump", {
                x: player.location.x,
                y: player.location.y,
                z: player.location.z
            });

            player.applyImpulse({ x: 0, y: 4.5, z: 0 });


            // ahora sí está en modo vuelo
            player.removeTag("sup_fly_precharge");
            player.addTag("sup_fly_active");

            // tag para controlar el sonido de dash
            player.removeTag("sup_fly_dash_sound_played"); // aseguramos que pueda sonar en esta sesión de vuelo
        }, 45); // aprox 2.5s (ajusta si tu anim es más corta o más larga)

        return;
    }

    // SI YA ESTÁ EN MODO VUELO → DASH
    const dir = player.getViewDirection();
    player.applyImpulse({
        x: dir.x * 2,
        y: 0.75,
        z: dir.z * 2
    });
    player.playAnimation("animation.supermanflight2");

    // reproducir sonido de dash solo 1 vez por vuelo
    if (!player.hasTag("sup_fly_dash_sound_played")) {
        player.playSound("stellar.superman_esencia");
        player.addTag("sup_fly_dash_sound_played");
    }
});

// si toca el suelo → termina el modo vuelo
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("sup_fly_active") && player.isOnGround) {
            player.removeTag("sup_fly_active");
            player.removeTag("sup_fly_dash_sound_played"); // reset del sonido
            player.sendMessage("§cFlight ended!");
            player.stopSound("stellar.superman_esencia");
        }
    }
}, 1);

// resistencia mientras esté en vuelo
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("sup_fly_active")) {
            // resistance 10 por 1 segundo, se renueva cada tick
            player.addEffect("resistance", 40, { amplifier: 10, showParticles: false });
        }
    }
}, 20);



const cameraSequence = [
    {
        location: { x: 100, y: 80, z: 100 },
        rotation: { x: 90, y: 0 },
        easeTime: 1,
        easeType: EasingType.InCubic,
        waitSeconds: 2
    },
    {
        location: { x: 120, y: 85, z: 100 },
        rotation: { x: 60, y: 90 },
        easeTime: 2,
        easeType: EasingType.OutCubic,
        waitSeconds: 3
    },
    {
        location: { x: 140, y: 90, z: 110 },
        rotation: { x: 45, y: 180 },
        easeTime: 1.5,
        easeType: EasingType.Linear,
        waitSeconds: 1
    }
];

// Función para ejecutar la secuencia sin async/await
function runCameraSequence(player, steps, index = 0) {
    const inputPermissions = player.inputPermissions

    if (index >= steps.length) {
        player.camera.clear();
        inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true)
        inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true)
        return;
    }

    const step = steps[index];

    player.camera.setCamera('minecraft:free', {
        location: step.location,
        rotation: step.rotation,
        facingEntity: step.facingEntity,
        facingLocation: step.facingLocation,
        easeOptions: {
            easeTime: step.easeTime ?? 1,
            easeType: step.easeType ?? EasingType.Linear
        }
    });

    const waitTicks = Math.floor((step.waitSeconds ?? 1) * 20);

    system.runTimeout(() => {
        runCameraSequence(player, steps, index + 1);
    }, waitTicks);
}


world.afterEvents.itemUse.subscribe(ev => {
    const { itemStack, source } = ev

    if (itemStack.typeId == 'minecraft:coal') {
        source.camera.setCamera('minecraft:free', {
            location: {
                x: source.location.x,
                y: source.getHeadLocation().y,
                z: source.location.z,

            },
            easeOptions: {
                easeTime: 1,
                easeType: EasingType.InCubic
            },
            rotation: source.getRotation()
        })
        system.runTimeout(() => {
            source.camera.clear()
        }, 19)
    }
})




world.afterEvents.itemUse.subscribe((ev) => {
    const { itemStack, source } = ev;

    if (!(source instanceof Player)) return;

    if (itemStack.typeId == 'minecraft:stick') {
        const { location } = source

        const inputPermissions = source.inputPermissions
        inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false)
        inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false)

        const cameraSequence1 = [
            // 1) pegado en la cara + puño
            {
                // cámara al lado del puño (derecha del jugador)
                location: Vec3.getLocalCoordinates(source, { x: 1, y: 1.5, z: -0.3 }),

                // que mire a la cabeza exacto del jugador
                facingLocation: Vec3.add(source.location, { x: 0, y: 1.6, z: 0 }),
                easeTime: 1.5,
                easeType: EasingType.OutCubic,
                waitSeconds: 1
            },
            // 2) se aleja pero frente
            {
                // cámara al lado del puño (derecha del jugador)
                location: Vec3.getLocalCoordinates(source, { x: 3, y: 1.5, z: -0.5 }),

                // que mire a la cabeza exacto del jugador
                facingLocation: Vec3.add(source.location, { x: 0, y: 1.6, z: 0 }),
                easeTime: 1.5,
                easeType: EasingType.OutCubic,
                waitSeconds: 2
            },
            {
                // cámara al lado del puño (derecha del jugador)
                location: Vec3.getLocalCoordinates(source, { x: 3, y: 1.5, z: -1.5 }),

                // que mire a la cabeza exacto del jugador
                facingLocation: Vec3.add(source.location, { x: 0, y: 1.6, z: 0 }),
                easeTime: 1.5,
                easeType: EasingType.OutCubic,
                waitSeconds: 2
            },
            // 3) rotación atrás mostrando espalda
            {
                location: Vec3.getLocalCoordinates(source, { x: -4, y: 2, z: 0 }),
                facingLocation: Vec3.getLocalCoordinates(source, { x: 8, y: 2, z: 0 }),
                easeTime: 1.5,
                easeType: EasingType.OutCubic,
                waitSeconds: 3
            }
        ];
        runCameraSequence(source, cameraSequence1);
    }
});