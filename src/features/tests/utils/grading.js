/**
 * Grading helpers — apply a grading_scale to a percentage.
 *
 * scale row: { id, school_code, name, scale: [...bands], is_default }
 * band shape: { min, max, grade, gpa, description }
 *   min and max are both inclusive (e.g. top band uses max: 100).
 */

export function getGrade(percentage, scaleRow) {
  if (percentage == null || isNaN(percentage)) return null;
  const bands = scaleRow?.scale;
  if (!Array.isArray(bands) || bands.length === 0) return null;
  const pct = Number(percentage);
  const band = bands.find(
    (b) => pct >= Number(b.min) && pct <= Number(b.max)
  );
  if (!band) return null;
  return {
    grade: band.grade,
    gpa: band.gpa != null ? Number(band.gpa) : null,
    description: band.description || null,
  };
}

export function sortedBands(scaleRow) {
  const bands = scaleRow?.scale;
  if (!Array.isArray(bands)) return [];
  return [...bands].sort((a, b) => Number(b.min) - Number(a.min));
}

// Pre-baked starter profiles to seed a school's first scale.
export const PRESETS = [
  {
    name: 'Standard Percentage',
    scale: [
      { min: 90, max: 100, grade: 'A+', gpa: 4.0, description: 'Outstanding' },
      { min: 80, max: 89,  grade: 'A',  gpa: 3.7, description: 'Excellent'   },
      { min: 70, max: 79,  grade: 'B+', gpa: 3.3, description: 'Very Good'   },
      { min: 60, max: 69,  grade: 'B',  gpa: 3.0, description: 'Good'        },
      { min: 50, max: 59,  grade: 'C',  gpa: 2.0, description: 'Average'     },
      { min: 33, max: 49,  grade: 'D',  gpa: 1.0, description: 'Below Avg'   },
      { min: 0,  max: 32,  grade: 'F',  gpa: 0.0, description: 'Fail'        },
    ],
  },
  {
    name: 'CBSE 9-Point GPA',
    scale: [
      { min: 91, max: 100, grade: 'A1', gpa: 9, description: 'Outstanding' },
      { min: 81, max: 90,  grade: 'A2', gpa: 8, description: 'Excellent'   },
      { min: 71, max: 80,  grade: 'B1', gpa: 7, description: 'Very Good'   },
      { min: 61, max: 70,  grade: 'B2', gpa: 6, description: 'Good'        },
      { min: 51, max: 60,  grade: 'C1', gpa: 5, description: 'Above Avg'   },
      { min: 41, max: 50,  grade: 'C2', gpa: 4, description: 'Average'     },
      { min: 33, max: 40,  grade: 'D',  gpa: 3, description: 'Below Avg'   },
      { min: 21, max: 32,  grade: 'E1', gpa: 0, description: 'Needs Work'  },
      { min: 0,  max: 20,  grade: 'E2', gpa: 0, description: 'Needs Work'  },
    ],
  },
  {
    name: 'Pass / Fail',
    scale: [
      { min: 33, max: 100, grade: 'Pass', gpa: null, description: '' },
      { min: 0,  max: 32,  grade: 'Fail', gpa: null, description: '' },
    ],
  },
];
