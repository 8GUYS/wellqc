export interface AnomalyOption {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
}

export const ANOMALY_CORRECTION_OPTIONS: Record<string, AnomalyOption[]> = {
  DUPLICATE_DEPTH: [
    {
      id: "DEDUPLICATE_KEEP_FIRST",
      label: "Prune duplicate depth rows (Keep first occurrence)",
      description: "Retains the initial tool measurement at the recorded depth index and drops subsequent duplicate rows.",
      recommended: true,
    },
    {
      id: "AVERAGE_DUPLICATES",
      label: "Average duplicate depth values across channels",
      description: "Calculates the arithmetic mean of all duplicate readings at this depth index.",
      recommended: false,
    },
    {
      id: "UNIFORM_STEP_RESAMPLE",
      label: "Uniform step re-indexing",
      description: "Re-samples and interpolates the depth track to enforce strict monotonic step increments.",
      recommended: false,
    },
  ],
  DEPTH_GAP: [
    {
      id: "LINEAR_INTERPOLATION",
      label: "Linear depth gap interpolation",
      description: "Constructs a smooth linear progression between the boundary depths to fill telemetry drops.",
      recommended: true,
    },
    {
      id: "CUBIC_SPLINE_INTERPOLATION",
      label: "Cubic spline depth interpolation",
      description: "Applies high-order cubic spline estimation across the gap interval.",
      recommended: false,
    },
    {
      id: "PRESERVE_GAP_NULL",
      label: "Preserve depth gap with null padding (-999.25)",
      description: "Leaves the gap marked explicitly with null indicators without estimating intermediate depths.",
      recommended: false,
    },
  ],
  EXTREME_SPIKE: [
    {
      id: "MEDIAN_DESPIKING",
      label: "Windowed median filter despiking (3-point filter)",
      description: "Replaces high-frequency electronic noise spikes and cycle skips with a local median value.",
      recommended: true,
    },
    {
      id: "GRADIENT_THRESHOLD_CLIP",
      label: "Gradient threshold clipping",
      description: "Attenuates spikes exceeding the formation change rate limit defined by logging tool physics.",
      recommended: false,
    },
    {
      id: "NULLIFY_FOR_IMPUTATION",
      label: "Nullify spike values for machine learning imputation",
      description: "Sets spurious spike points to null (-999.25) to be reconstructed using multi-channel regression.",
      recommended: false,
    },
  ],
  OUTLIER_VALUE: [
    {
      id: "PHYSICAL_LIMIT_CLIP",
      label: "Clip to API / SPWLA physical formation limits",
      description: "Binds unrealistic measurements to allowable petrophysical boundaries for the given lithology.",
      recommended: true,
    },
    {
      id: "SIGMA_CLIP",
      label: "Statistical 3-sigma boundary clipping",
      description: "Clips anomalous outliers falling beyond 3 standard deviations of the well section mean.",
      recommended: false,
    },
    {
      id: "FLAG_AND_RETAIN",
      label: "Retain raw values with petrophysical QA flag",
      description: "Keeps numerical readings intact while flagging the interval in the quality audit metadata.",
      recommended: false,
    },
  ],
  IMPOSSIBLE_VALUE: [
    {
      id: "CLIP_TO_PHYSICAL_RANGE",
      label: "Clip strictly to physical tool limits",
      description: "Forces negative readings or impossible values to the minimum physical detection threshold.",
      recommended: true,
    },
    {
      id: "NULLIFY_AND_KNN_IMPUTE",
      label: "Convert to null and perform KNN multi-channel imputation",
      description: "Reconstructs unphysical readings using cross-curve correlation from correlated channels.",
      recommended: false,
    },
  ],
  FLATLINE: [
    {
      id: "FLAG_TOOL_STICK",
      label: "Flag suspect tool-stick interval in audit log",
      description: "Identifies mechanical wireline stick-and-pull artifacts without altering the recorded curve data.",
      recommended: true,
    },
    {
      id: "NULLIFY_STUCK_INTERVAL",
      label: "Convert stuck interval to nulls (-999.25)",
      description: "Removes invalid flatline measurements to prevent skewing average reservoir calculations.",
      recommended: false,
    },
    {
      id: "INTERPOLATE_STUCK_INTERVAL",
      label: "Interpolate across stuck interval",
      description: "Connects pre-stick and post-stick depths with interpolated trend values.",
      recommended: false,
    },
  ],
  NULL_CLUSTER: [
    {
      id: "KNN_IMPUTATION",
      label: "Multi-channel K-Nearest Neighbors (KNN) regression",
      description: "Imputes missing null clusters by finding similar petrophysical intervals across valid channels.",
      recommended: true,
    },
    {
      id: "LINEAR_INTERPOLATION",
      label: "Linear interpolation across null interval",
      description: "Performs standard linear interpolation between the nearest valid boundary depths.",
      recommended: false,
    },
    {
      id: "MEDIAN_IMPUTATION",
      label: "Formation zonal median replacement",
      description: "Fills missing values with the median response for that specific lithological zone.",
      recommended: false,
    },
  ],
  UNIT_MISMATCH: [
    {
      id: "AUTO_CONVERT_STANDARDIZE",
      label: "Convert to SPWLA standard units & rescale numerical data",
      description: "Automatically rescales numerical values into standard petrophysical units (e.g., bar to psi, g/cm³).",
      recommended: true,
    },
    {
      id: "UPDATE_HEADER_SYMBOL_ONLY",
      label: "Update header unit symbol only (no numerical rescaling)",
      description: "Updates the LAS ~C curve unit field without adjusting curve values.",
      recommended: false,
    },
  ],
  NON_STANDARD_MNEMONIC: [
    {
      id: "STANDARDIZE_MNEMONIC",
      label: "Remap mnemonic to industry-standard alias (SPWLA)",
      description: "Standardizes vendor-specific mnemonics into common petrophysical aliases (e.g., GRD/CGR to GR).",
      recommended: true,
    },
    {
      id: "RETAIN_RAW_ALIAS",
      label: "Retain raw vendor mnemonic with secondary metadata tag",
      description: "Preserves the original contractor mnemonic name while noting standard equivalence.",
      recommended: false,
    },
  ],
  DUPLICATE_CURVE: [
    {
      id: "DEDUPLICATE_PRIMARY_CHANNEL",
      label: "Retain primary channel and discard redundant duplicate",
      description: "Preserves the primary calibrated curve and eliminates duplicate channel definitions.",
      recommended: true,
    },
    {
      id: "RENAME_SECONDARY_CHANNEL",
      label: "Rename secondary channel with distinct suffix (_2)",
      description: "Appends an index suffix to differentiate repeated runs or pass logs.",
      recommended: false,
    },
  ],
  MISSING_CORE_CURVE: [
    {
      id: "FLAG_INCOMPLETE_SUITE",
      label: "Flag well log suite as incomplete in audit certificate",
      description: "Documents the absence of standard triple-combo channels in the final QA audit certificate.",
      recommended: true,
    },
    {
      id: "SYNTHETIC_CHANNEL_DERIVATION",
      label: "Derive synthetic pseudo-curve from available channels",
      description: "Uses empirical petrophysical relationships to approximate missing log responses.",
      recommended: false,
    },
  ],
};

export function getCorrectionOptionsForType(anomalyType: string): AnomalyOption[] {
  const normalized = anomalyType.trim().toUpperCase();
  if (ANOMALY_CORRECTION_OPTIONS[normalized]) {
    return ANOMALY_CORRECTION_OPTIONS[normalized];
  }

  // Generic fallback options for custom/unclassified anomalies
  return [
    {
      id: "AUTO_RECOMMENDED_FIX",
      label: "Apply standard petrophysical algorithmic correction",
      description: "Applies automated multi-stage correction tailored to this curve type.",
      recommended: true,
    },
    {
      id: "FLAG_AND_RETAIN",
      label: "Retain raw values and annotate in audit trail",
      description: "Preserves recorded data point and creates an audit observation.",
      recommended: false,
    },
  ];
}
