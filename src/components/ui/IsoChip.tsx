interface IsoChipProps {
  code: string;
}

export function IsoChip({ code }: IsoChipProps) {
  return <span className="iso-chip">{code}</span>;
}
