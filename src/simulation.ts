export type BuildingKind = 'farm' | 'lumberyard' | 'quarry';
export interface Building { id: number; kind: BuildingKind; x: number; y: number }
export interface World { tick: number; gold: number; wood: number; stone: number; buildings: Building[]; nextId: number }
export type Command = { type: 'build'; kind: BuildingKind; x: number; y: number } | { type: 'advance'; ticks: number };
export const COSTS: Record<BuildingKind, {gold:number;wood:number;stone:number}> = { farm: {gold:30,wood:15,stone:0}, lumberyard:{gold:45,wood:0,stone:10}, quarry:{gold:55,wood:20,stone:0} };
export function initialWorld(): World { return {tick:0,gold:200,wood:100,stone:50,buildings:[],nextId:1}; }
export function applyCommand(world:World,command:Command):World {
  if(command.type==='advance') {
    if(!Number.isSafeInteger(command.ticks)||command.ticks<0||command.ticks>1000) return world;
    const farms=world.buildings.filter(b=>b.kind==='farm').length;
    const mills=world.buildings.filter(b=>b.kind==='lumberyard').length;
    const quarries=world.buildings.filter(b=>b.kind==='quarry').length;
    return {...world,tick:world.tick+command.ticks,gold:world.gold+farms*command.ticks,wood:world.wood+mills*command.ticks,stone:world.stone+quarries*command.ticks};
  }
  const {x,y,kind}=command;
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=12||y<0||y>=8) return world;
  if(world.buildings.some(b=>b.x===x&&b.y===y)) return world;
  const cost=COSTS[kind]; if(!cost||world.gold<cost.gold||world.wood<cost.wood||world.stone<cost.stone) return world;
  return {...world,gold:world.gold-cost.gold,wood:world.wood-cost.wood,stone:world.stone-cost.stone,nextId:world.nextId+1,buildings:[...world.buildings,{id:world.nextId,kind,x,y}]};
}
