export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      asaas_webhooks: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
      blog_posts_ai: {
        Row: {
          category: string
          city_slug: string | null
          content_md: string
          content_md_en: string | null
          created_at: string
          cta: string | null
          cta_en: string | null
          excerpt: string
          excerpt_en: string | null
          faq: Json | null
          faq_en: Json | null
          id: string
          image_alt_en: string | null
          image_alt_pt: string | null
          image_prompt: string | null
          image_source: string | null
          image_url: string | null
          internal_links: Json | null
          keywords: string[] | null
          meta_description: string
          meta_description_en: string | null
          meta_title: string
          meta_title_en: string | null
          published_at: string | null
          read_time: string
          service_slug: string | null
          slug: string
          status: string
          tag: string
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          city_slug?: string | null
          content_md?: string
          content_md_en?: string | null
          created_at?: string
          cta?: string | null
          cta_en?: string | null
          excerpt?: string
          excerpt_en?: string | null
          faq?: Json | null
          faq_en?: Json | null
          id?: string
          image_alt_en?: string | null
          image_alt_pt?: string | null
          image_prompt?: string | null
          image_source?: string | null
          image_url?: string | null
          internal_links?: Json | null
          keywords?: string[] | null
          meta_description?: string
          meta_description_en?: string | null
          meta_title?: string
          meta_title_en?: string | null
          published_at?: string | null
          read_time?: string
          service_slug?: string | null
          slug: string
          status?: string
          tag?: string
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          city_slug?: string | null
          content_md?: string
          content_md_en?: string | null
          created_at?: string
          cta?: string | null
          cta_en?: string | null
          excerpt?: string
          excerpt_en?: string | null
          faq?: Json | null
          faq_en?: Json | null
          id?: string
          image_alt_en?: string | null
          image_alt_pt?: string | null
          image_prompt?: string | null
          image_source?: string | null
          image_url?: string | null
          internal_links?: Json | null
          keywords?: string[] | null
          meta_description?: string
          meta_description_en?: string | null
          meta_title?: string
          meta_title_en?: string | null
          published_at?: string | null
          read_time?: string
          service_slug?: string | null
          slug?: string
          status?: string
          tag?: string
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budget_leads: {
        Row: {
          city: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          observations: string | null
          phone: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          observations?: string | null
          phone?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          observations?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      cep_cache: {
        Row: {
          cep: string
          created_at: string
          data: Json
        }
        Insert: {
          cep: string
          created_at?: string
          data: Json
        }
        Update: {
          cep?: string
          created_at?: string
          data?: Json
        }
        Relationships: []
      }
      client_events: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          event_type: string
          id: string
          related_id: string | null
          related_table: string | null
          title: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          event_type: string
          id?: string
          related_id?: string | null
          related_table?: string | null
          title: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          event_type?: string
          id?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpj_cache: {
        Row: {
          cnpj: string
          created_at: string
          data: Json
        }
        Insert: {
          cnpj: string
          created_at?: string
          data: Json
        }
        Update: {
          cnpj?: string
          created_at?: string
          data?: Json
        }
        Relationships: []
      }
      contract_equipment: {
        Row: {
          computer_model: string
          contract_id: string | null
          cpu: string
          cpu_generation: string
          created_at: string
          id: string
          keyboard_model: string
          monitor_brand: string
          monitor_size: string
          monthly_total: number
          mouse_model: string
          network: string
          quantity: number
          ram: string
          ssd: string
          unit_price: number
        }
        Insert: {
          computer_model?: string
          contract_id?: string | null
          cpu: string
          cpu_generation: string
          created_at?: string
          id?: string
          keyboard_model?: string
          monitor_brand?: string
          monitor_size?: string
          monthly_total: number
          mouse_model?: string
          network?: string
          quantity: number
          ram?: string
          ssd?: string
          unit_price: number
        }
        Update: {
          computer_model?: string
          contract_id?: string | null
          cpu?: string
          cpu_generation?: string
          created_at?: string
          id?: string
          keyboard_model?: string
          monitor_brand?: string
          monitor_size?: string
          monthly_total?: number
          mouse_model?: string
          network?: string
          quantity?: number
          ram?: string
          ssd?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_equipment_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_hash: string | null
          contract_id: string
          id: string
          ip_address: string | null
          signature_data: string
          signed_at: string
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          contract_hash?: string | null
          contract_id: string
          id?: string
          ip_address?: string | null
          signature_data: string
          signed_at?: string
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          contract_hash?: string | null
          contract_id?: string
          id?: string
          ip_address?: string | null
          signature_data?: string
          signed_at?: string
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          ativo: boolean
          created_at: string
          editavel: boolean
          id: string
          nome: string
          template_text: string
          tipo: string
          updated_at: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          editavel?: boolean
          id: string
          nome: string
          template_text: string
          tipo?: string
          updated_at?: string
          versao?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          editavel?: boolean
          id?: string
          nome?: string
          template_text?: string
          tipo?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          accepted_minimum_term: boolean | null
          client_ip: string | null
          contract_hash: string | null
          contract_pdf_path: string | null
          contract_text: string | null
          contract_type: string | null
          created_at: string
          customer_id: string | null
          id: string
          monthly_value: number | null
          quote_id: string | null
          signed: boolean | null
          signed_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_minimum_term?: boolean | null
          client_ip?: string | null
          contract_hash?: string | null
          contract_pdf_path?: string | null
          contract_text?: string | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          monthly_value?: number | null
          quote_id?: string | null
          signed?: boolean | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_minimum_term?: boolean | null
          client_ip?: string | null
          contract_hash?: string | null
          contract_pdf_path?: string | null
          contract_text?: string | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          monthly_value?: number | null
          quote_id?: string | null
          signed?: boolean | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj_ou_cpf: string
          created_at: string
          email: string
          endereco: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string
          responsavel: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj_ou_cpf: string
          created_at?: string
          email: string
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          responsavel: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj_ou_cpf?: string
          created_at?: string
          email?: string
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          responsavel?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fiscal_documents: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string
          customer_id: string
          document_number: string | null
          document_type: string
          file_url: string | null
          id: string
          issue_date: string
          notes: string | null
          payment_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          customer_id: string
          document_number?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          payment_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          customer_id?: string
          document_number?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          payment_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          integration_name: string
          operation_name: string
          request_payload: Json | null
          response_payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_name: string
          operation_name: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_name?: string
          operation_name?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          lead_status: string | null
          message: string | null
          name: string
          phone: string | null
          service_interest: string | null
          source_page: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          lead_status?: string | null
          message?: string | null
          name: string
          phone?: string | null
          service_interest?: string | null
          source_page?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_status?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          service_interest?: string | null
          source_page?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      logs_sistema: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          payload: Json | null
          status: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          payload?: Json | null
          status?: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          payload?: Json | null
          status?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      network_diagnostics: {
        Row: {
          average_pc_age: string | null
          computers_current: number | null
          created_at: string
          has_backup: boolean | null
          has_server: boolean | null
          id: string
          maintenance_frequency: string | null
          quote_id: string | null
        }
        Insert: {
          average_pc_age?: string | null
          computers_current?: number | null
          created_at?: string
          has_backup?: boolean | null
          has_server?: boolean | null
          id?: string
          maintenance_frequency?: string | null
          quote_id?: string | null
        }
        Update: {
          average_pc_age?: string | null
          computers_current?: number | null
          created_at?: string
          has_backup?: boolean | null
          has_server?: boolean | null
          id?: string
          maintenance_frequency?: string | null
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_diagnostics_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          billing_type: string | null
          created_at: string
          due_date: string | null
          id: string
          payment_method: string | null
          payment_status: string | null
          quote_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          quote_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          quote_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_intelligence: {
        Row: {
          analysis_data: Json | null
          analysis_type: string
          applied: boolean | null
          applied_at: string | null
          auto_applicable: boolean | null
          confidence: number | null
          created_at: string
          finished_at: string | null
          high_priority: number | null
          id: string
          impact_score: number | null
          low_priority: number | null
          medium_priority: number | null
          prompt_type: string | null
          prompts: Json | null
          rejected_at: string | null
          source: string | null
          status: string
          summary: string | null
          total_prompts: number | null
          triggered_by: string | null
        }
        Insert: {
          analysis_data?: Json | null
          analysis_type?: string
          applied?: boolean | null
          applied_at?: string | null
          auto_applicable?: boolean | null
          confidence?: number | null
          created_at?: string
          finished_at?: string | null
          high_priority?: number | null
          id?: string
          impact_score?: number | null
          low_priority?: number | null
          medium_priority?: number | null
          prompt_type?: string | null
          prompts?: Json | null
          rejected_at?: string | null
          source?: string | null
          status?: string
          summary?: string | null
          total_prompts?: number | null
          triggered_by?: string | null
        }
        Update: {
          analysis_data?: Json | null
          analysis_type?: string
          applied?: boolean | null
          applied_at?: string | null
          auto_applicable?: boolean | null
          confidence?: number | null
          created_at?: string
          finished_at?: string | null
          high_priority?: number | null
          id?: string
          impact_score?: number | null
          low_priority?: number | null
          medium_priority?: number | null
          prompt_type?: string | null
          prompts?: Json | null
          rejected_at?: string | null
          source?: string | null
          status?: string
          summary?: string | null
          total_prompts?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          computers_qty: number
          contract_months: number
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          plan: string
          quote_id: string | null
          status: string
          total_value: number
          unit_price: number
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          computers_qty?: number
          contract_months?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          plan?: string
          quote_id?: string | null
          status?: string
          total_value?: number
          unit_price?: number
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Update: {
          computers_qty?: number
          contract_months?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          plan?: string
          quote_id?: string | null
          status?: string
          total_value?: number
          unit_price?: number
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          computers_qty: number | null
          created_at: string
          id: string
          lead_id: string | null
          monthly_value: number | null
          needs_backup: boolean | null
          needs_remote_access: boolean | null
          needs_server_migration: boolean | null
          selected_plan: string | null
          status: string | null
          users_qty: number | null
        }
        Insert: {
          computers_qty?: number | null
          created_at?: string
          id?: string
          lead_id?: string | null
          monthly_value?: number | null
          needs_backup?: boolean | null
          needs_remote_access?: boolean | null
          needs_server_migration?: boolean | null
          selected_plan?: string | null
          status?: string | null
          users_qty?: number | null
        }
        Update: {
          computers_qty?: number | null
          created_at?: string
          id?: string
          lead_id?: string | null
          monthly_value?: number | null
          needs_backup?: boolean | null
          needs_remote_access?: boolean | null
          needs_server_migration?: boolean | null
          selected_plan?: string | null
          status?: string | null
          users_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "budget_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_intelligence: {
        Row: {
          actual_value: number | null
          analysis_summary: string | null
          company_size: string | null
          conversion_probability: number | null
          converted: boolean | null
          created_at: string
          decision_stage: string | null
          discount_suggested: number | null
          id: string
          lead_id: string | null
          lead_value_estimate: number | null
          machines_qty: number | null
          pain_point: string | null
          price_suggested: number | null
          quote_id: string | null
          sector: string | null
          service_type: string | null
          strategy: string | null
          updated_at: string
          urgency_level: string | null
        }
        Insert: {
          actual_value?: number | null
          analysis_summary?: string | null
          company_size?: string | null
          conversion_probability?: number | null
          converted?: boolean | null
          created_at?: string
          decision_stage?: string | null
          discount_suggested?: number | null
          id?: string
          lead_id?: string | null
          lead_value_estimate?: number | null
          machines_qty?: number | null
          pain_point?: string | null
          price_suggested?: number | null
          quote_id?: string | null
          sector?: string | null
          service_type?: string | null
          strategy?: string | null
          updated_at?: string
          urgency_level?: string | null
        }
        Update: {
          actual_value?: number | null
          analysis_summary?: string | null
          company_size?: string | null
          conversion_probability?: number | null
          converted?: boolean | null
          created_at?: string
          decision_stage?: string | null
          discount_suggested?: number | null
          id?: string
          lead_id?: string | null
          lead_value_estimate?: number | null
          machines_qty?: number | null
          pain_point?: string | null
          price_suggested?: number | null
          quote_id?: string | null
          sector?: string | null
          service_type?: string | null
          strategy?: string | null
          updated_at?: string
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_intelligence_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_intelligence_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string
          event_type: string
          id: string
          ip_address: string | null
          payload: Json | null
          request_id: string | null
          route: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description: string
          event_type: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          request_id?: string | null
          route?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          request_id?: string | null
          route?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          priority: string
          quote_id: string | null
          service_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          service_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          service_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      test_alert_config: {
        Row: {
          channel: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_run_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          run_id: string
          spec_name: string | null
          stack_trace: string | null
          status: string | null
          test_name: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          run_id: string
          spec_name?: string | null
          stack_trace?: string | null
          status?: string | null
          test_name?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          run_id?: string
          spec_name?: string | null
          stack_trace?: string | null
          status?: string | null
          test_name?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          base_url: string | null
          browser: string | null
          build_ref: string | null
          client_id: string | null
          client_name: string | null
          completed_specs: number | null
          completed_tests: number | null
          created_at: string
          current_spec: string | null
          current_test: string | null
          current_url: string | null
          duration_ms: number | null
          environment: string | null
          error_message: string | null
          error_summary: string | null
          execution_engine: string | null
          failed_tests: number | null
          finished_at: string | null
          github_run_id: string | null
          github_run_url: string | null
          id: string
          ingest_token: string | null
          last_event_at: string | null
          logs: Json | null
          passed_tests: number | null
          plan_type: string | null
          progress_percent: number | null
          report_url: string | null
          results: Json | null
          screenshot_urls: string[] | null
          skipped_tests: number | null
          started_at: string | null
          status: string
          suite: string
          test_type: string
          total_specs: number | null
          total_tests: number | null
          triggered_by: string | null
          updated_at: string
          video_urls: string[] | null
          viewport: string | null
        }
        Insert: {
          base_url?: string | null
          browser?: string | null
          build_ref?: string | null
          client_id?: string | null
          client_name?: string | null
          completed_specs?: number | null
          completed_tests?: number | null
          created_at?: string
          current_spec?: string | null
          current_test?: string | null
          current_url?: string | null
          duration_ms?: number | null
          environment?: string | null
          error_message?: string | null
          error_summary?: string | null
          execution_engine?: string | null
          failed_tests?: number | null
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          ingest_token?: string | null
          last_event_at?: string | null
          logs?: Json | null
          passed_tests?: number | null
          plan_type?: string | null
          progress_percent?: number | null
          report_url?: string | null
          results?: Json | null
          screenshot_urls?: string[] | null
          skipped_tests?: number | null
          started_at?: string | null
          status?: string
          suite: string
          test_type?: string
          total_specs?: number | null
          total_tests?: number | null
          triggered_by?: string | null
          updated_at?: string
          video_urls?: string[] | null
          viewport?: string | null
        }
        Update: {
          base_url?: string | null
          browser?: string | null
          build_ref?: string | null
          client_id?: string | null
          client_name?: string | null
          completed_specs?: number | null
          completed_tests?: number | null
          created_at?: string
          current_spec?: string | null
          current_test?: string | null
          current_url?: string | null
          duration_ms?: number | null
          environment?: string | null
          error_message?: string | null
          error_summary?: string | null
          execution_engine?: string | null
          failed_tests?: number | null
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          ingest_token?: string | null
          last_event_at?: string | null
          logs?: Json | null
          passed_tests?: number | null
          plan_type?: string | null
          progress_percent?: number | null
          report_url?: string | null
          results?: Json | null
          screenshot_urls?: string[] | null
          skipped_tests?: number | null
          started_at?: string | null
          status?: string
          suite?: string
          test_type?: string
          total_specs?: number | null
          total_tests?: number | null
          triggered_by?: string | null
          updated_at?: string
          video_urls?: string[] | null
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
