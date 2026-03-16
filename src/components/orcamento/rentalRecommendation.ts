export interface RentalAssessmentInput {
  activities?: string[] | null;
  computersQty?: number | null;
  dailyUsers?: number | null;
  equipmentType?: string | null;
  growthForecast?: string | null;
  hasAutomaticBackup?: string | null;
  hasServer?: string | null;
  manyTabs?: string | null;
  segment?: string | null;
  wantsServer?: string | null;
}

export const recommendRentalPlan = (data: RentalAssessmentInput): "essencial" | "equilibrio" | "performance" => {
  const activities = data.activities ?? [];
  const manyTabs = data.manyTabs ?? "";
  const dailyUsers = data.dailyUsers ?? 0;
  const computersQty = data.computersQty ?? 0;
  const segment = (data.segment ?? "").toLowerCase();

  let score = 0;

  if (activities.some((activity) => ["Software de engenharia", "Software de design"].includes(activity))) {
    score += 3;
  }

  if (activities.some((activity) => ["ERP empresarial", "Programação", "Uso misto"].includes(activity))) {
    score += 2;
  }

  if (activities.some((activity) => ["Sistemas jurídicos", "Sistemas contábeis", "Pacote Office"].includes(activity))) {
    score += 1;
  }

  if (manyTabs === "Sim") score += 2;
  if (manyTabs === "Às vezes") score += 1;
  if (dailyUsers >= 20) score += 1;
  if (computersQty >= 20) score += 1;
  if (["tecnologia", "indústria"].includes(segment)) score += 1;

  if (score >= 4) return "performance";
  if (score >= 2) return "equilibrio";
  return "essencial";
};

export const recommendRentalAddons = (data: RentalAssessmentInput) => ({
  backup: data.hasAutomaticBackup !== "Sim",
  remoteAccess:
    data.equipmentType === "Notebook" ||
    data.equipmentType === "Ambos" ||
    data.growthForecast === "Até 10 novos usuários" ||
    data.growthForecast === "Mais de 10 novos usuários",
  serverMigration:
    data.hasServer === "Sim" ||
    data.wantsServer === "Sim" ||
    data.wantsServer === "Preciso de recomendação",
});
