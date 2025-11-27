import Airtable from "airtable";

export class AirtableClient {
  private baseId: string;
  private apiKey: string;

  constructor(apiKey: string, baseId: string) {
    this.apiKey = apiKey;
    this.baseId = baseId;
  }

  private get base() {
    return new Airtable({ apiKey: this.apiKey }).base(this.baseId);
  }

  async fetchRecords(
    tableId: string,
    options: {
      filterByFormula?: string;
      sort?: { field: string; direction: "asc" | "desc" }[];
      maxRecords?: number;
    } = {}
  ) {
    try {
      const records = await this.base(tableId)
        .select({
          filterByFormula: options.filterByFormula,
          sort: options.sort,
          maxRecords: options.maxRecords,
        })
        .all();

      return records.map((record) => ({
        id: record.id,
        fields: record.fields,
        createdTime: record._raw.createdTime,
      }));
    } catch (error) {
      console.error("Error fetching records from Airtable:", error);
      throw error;
    }
  }

  async updateRecord(tableId: string, recordId: string, fields: Record<string, any>) {
    try {
      return await this.base(tableId).update(recordId, fields);
    } catch (error) {
      console.error("Error updating record in Airtable:", error);
      throw error;
    }
  }

  async fetchTableSchema(tableId: string) {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }

      const data = await response.json();
      const table = data.tables.find((t: any) => t.id === tableId || t.name === tableId);

      if (!table) {
        throw new Error(`Table ${tableId} not found in base`);
      }

      return table.fields;
    } catch (error) {
      console.error("Error fetching table schema:", error);
      throw error;
    }
  }
}

