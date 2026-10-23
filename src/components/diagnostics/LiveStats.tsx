import { Card, Tile } from "@/components/ui";
import { TEMP_CRIT_C, TEMP_WARN_C, VIB_CRIT_MM_S, VIB_WARN_MM_S } from "@/lib/constants";
import { average } from "@/lib/domain/readings";
import { dateOf, fmt, timeOf } from "@/lib/format";
import type { Reading } from "@/lib/types";

const level = (v: number | null, warn: number, crit: number) => (v === null ? undefined : v > crit ? "crit" : v > warn ? "warn" : undefined);

/** 8 live tiles for the selected machine. `rows` is oldest → newest. */
export function LiveStats({ machine, rows, range, ratedKw }: { machine: string; rows: Reading[]; range: number; ratedKw: string }) {
  const r = rows[rows.length - 1] ?? null;
  const pulse = r?.timestamp; // all tiles flash together when a new reading lands
  const avg = (k: Parameters<typeof average>[1]) => average(rows, k);

  return (
    <Card label={`LIVE STATS / ${machine}`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="TEMPERATURE"
          value={fmt.temp(r?.temperature_c)}
          unit="°C"
          sub={`avg ${fmt.temp(avg("temperature_c"))}°C`}
          state={level(r?.temperature_c ?? null, TEMP_WARN_C, TEMP_CRIT_C)}
          pulseKey={pulse}
        />
        <Tile
          label="VIBRATION"
          value={fmt.vib(r?.vibration_mm_s)}
          unit="mm/s"
          sub={`avg ${fmt.vib(avg("vibration_mm_s"))} mm/s`}
          state={level(r?.vibration_mm_s ?? null, VIB_WARN_MM_S, VIB_CRIT_MM_S)}
          pulseKey={pulse}
        />
        <Tile label="POWER" value={fmt.power(r?.power_kw)} unit="kW" sub={`avg ${fmt.power(avg("power_kw"))} kW`} pulseKey={pulse} />
        <Tile label="LOAD" value={fmt.load(r?.load_factor_pct)} unit="%" sub={`avg ${fmt.load(avg("load_factor_pct"))} %`} pulseKey={pulse} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile size="md" label="VOLTAGE / CURRENT" value={`${r?.voltage_v ?? "—"}V / ${r?.current_amps ?? "—"}A`} sub={`rated ${ratedKw || "—"} kW`} pulseKey={pulse} />
        <Tile size="md" label="POWER FACTOR / FREQ" value={`${r?.power_factor ?? "—"} / ${r?.frequency_hz ?? "—"}Hz`} sub="" pulseKey={pulse} />
        <Tile size="md" label="LAST SEEN" value={timeOf(r?.timestamp)} sub={dateOf(r?.timestamp)} />
        <Tile size="md" label="SAMPLES" value={`${rows.length} pts`} sub={`range ${range}`} />
      </div>
    </Card>
  );
}
