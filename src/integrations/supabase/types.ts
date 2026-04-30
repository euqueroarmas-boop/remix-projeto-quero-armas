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
    PostgrestVersion: "14.5"
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
      asaas_customer_map: {
        Row: {
          asaas_customer_id: string
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          asaas_customer_id: string
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_customer_map_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      certificate_config: {
        Row: {
          auto_sign_enabled: boolean
          certificate_hash: string
          certificate_storage_path: string
          created_at: string
          id: string
          issuer: string | null
          last_used_at: string | null
          serial_number: string | null
          status: string
          subject: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          auto_sign_enabled?: boolean
          certificate_hash: string
          certificate_storage_path: string
          created_at?: string
          id?: string
          issuer?: string | null
          last_used_at?: string | null
          serial_number?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          auto_sign_enabled?: boolean
          certificate_hash?: string
          certificate_storage_path?: string
          created_at?: string
          id?: string
          issuer?: string | null
          last_used_at?: string | null
          serial_number?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
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
      cliente_acesso_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          detalhes: Json | null
          email: string | null
          evento: string
          id: string
          identificador_mascarado: string | null
          ip: string | null
          qa_cliente_id: number | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          detalhes?: Json | null
          email?: string | null
          evento: string
          id?: string
          identificador_mascarado?: string | null
          ip?: string | null
          qa_cliente_id?: number | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          detalhes?: Json | null
          email?: string | null
          evento?: string
          id?: string
          identificador_mascarado?: string | null
          ip?: string | null
          qa_cliente_id?: number | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cliente_auth_links: {
        Row: {
          activated_at: string | null
          created_at: string
          customer_id: string | null
          documento_normalizado: string | null
          email: string | null
          email_pendente: string | null
          id: string
          last_login_at: string | null
          motivo: string | null
          qa_cliente_id: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          customer_id?: string | null
          documento_normalizado?: string | null
          email?: string | null
          email_pendente?: string | null
          id?: string
          last_login_at?: string | null
          motivo?: string | null
          qa_cliente_id?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          customer_id?: string | null
          documento_normalizado?: string | null
          email?: string | null
          email_pendente?: string | null
          id?: string
          last_login_at?: string | null
          motivo?: string | null
          qa_cliente_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_auth_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_auth_links_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_auth_links_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cliente_auth_links_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cliente_auth_links_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "fk_cliente_auth_links__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cliente_auth_links__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_cliente_auth_links__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_cliente_auth_links__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      cliente_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          customer_id: string | null
          documento_normalizado: string | null
          email: string
          expires_at: string
          id: string
          ip: string | null
          purpose: string
          qa_cliente_id: number | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          customer_id?: string | null
          documento_normalizado?: string | null
          email: string
          expires_at: string
          id?: string
          ip?: string | null
          purpose?: string
          qa_cliente_id?: number | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          customer_id?: string | null
          documento_normalizado?: string | null
          email?: string
          expires_at?: string
          id?: string
          ip?: string | null
          purpose?: string
          qa_cliente_id?: number | null
        }
        Relationships: []
      }
      cms_blocks: {
        Row: {
          active: boolean
          block_type: string
          created_at: string
          default_data: Json | null
          id: string
          is_global: boolean
          label: string
          page_id: string | null
          sort_order: number | null
          updated_at: string
          variant: string | null
        }
        Insert: {
          active?: boolean
          block_type: string
          created_at?: string
          default_data?: Json | null
          id?: string
          is_global?: boolean
          label: string
          page_id?: string | null
          sort_order?: number | null
          updated_at?: string
          variant?: string | null
        }
        Update: {
          active?: boolean
          block_type?: string
          created_at?: string
          default_data?: Json | null
          id?: string
          is_global?: boolean
          label?: string
          page_id?: string | null
          sort_order?: number | null
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cms_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          benefits_data: Json | null
          blocks_order: Json | null
          calculator_config: Json | null
          canonical_url: string | null
          compliance_data: Json | null
          created_at: string
          cta_data: Json | null
          faq_data: Json | null
          hero_data: Json | null
          id: string
          legacy_component: string | null
          meta_description: string | null
          meta_title: string | null
          niche_data: Json | null
          noindex: boolean
          og_image: string | null
          page_type: string
          pain_data: Json | null
          pricing_config: Json | null
          proof_data: Json | null
          published_at: string | null
          related_segments: string[] | null
          related_services: string[] | null
          scope_data: Json | null
          sitemap_changefreq: string | null
          sitemap_priority: string | null
          slug: string
          solution_data: Json | null
          status: string
          template: string
          title: string
          updated_at: string
        }
        Insert: {
          benefits_data?: Json | null
          blocks_order?: Json | null
          calculator_config?: Json | null
          canonical_url?: string | null
          compliance_data?: Json | null
          created_at?: string
          cta_data?: Json | null
          faq_data?: Json | null
          hero_data?: Json | null
          id?: string
          legacy_component?: string | null
          meta_description?: string | null
          meta_title?: string | null
          niche_data?: Json | null
          noindex?: boolean
          og_image?: string | null
          page_type?: string
          pain_data?: Json | null
          pricing_config?: Json | null
          proof_data?: Json | null
          published_at?: string | null
          related_segments?: string[] | null
          related_services?: string[] | null
          scope_data?: Json | null
          sitemap_changefreq?: string | null
          sitemap_priority?: string | null
          slug: string
          solution_data?: Json | null
          status?: string
          template?: string
          title: string
          updated_at?: string
        }
        Update: {
          benefits_data?: Json | null
          blocks_order?: Json | null
          calculator_config?: Json | null
          canonical_url?: string | null
          compliance_data?: Json | null
          created_at?: string
          cta_data?: Json | null
          faq_data?: Json | null
          hero_data?: Json | null
          id?: string
          legacy_component?: string | null
          meta_description?: string | null
          meta_title?: string | null
          niche_data?: Json | null
          noindex?: boolean
          og_image?: string | null
          page_type?: string
          pain_data?: Json | null
          pricing_config?: Json | null
          proof_data?: Json | null
          published_at?: string | null
          related_segments?: string[] | null
          related_services?: string[] | null
          scope_data?: Json | null
          sitemap_changefreq?: string | null
          sitemap_priority?: string | null
          slug?: string
          solution_data?: Json | null
          status?: string
          template?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_pricing_rules: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          criticality_high: number
          criticality_low: number
          criticality_medium: number
          id: string
          min_value: number | null
          os_type: string
          progressive_discount: Json | null
          resource_type: string
          sla_24h_multiplier: number
          sla_standard_multiplier: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          criticality_high?: number
          criticality_low?: number
          criticality_medium?: number
          id?: string
          min_value?: number | null
          os_type?: string
          progressive_discount?: Json | null
          resource_type: string
          sla_24h_multiplier?: number
          sla_standard_multiplier?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          criticality_high?: number
          criticality_low?: number
          criticality_medium?: number
          id?: string
          min_value?: number | null
          os_type?: string
          progressive_discount?: Json | null
          resource_type?: string
          sla_24h_multiplier?: number
          sla_standard_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      cms_redirects: {
        Row: {
          active: boolean
          created_at: string
          from_slug: string
          id: string
          to_slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          from_slug: string
          id?: string
          to_slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          from_slug?: string
          id?: string
          to_slug?: string
        }
        Relationships: []
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
          activated_at: string | null
          client_ip: string | null
          contract_hash: string | null
          contract_pdf_path: string | null
          contract_text: string | null
          contract_type: string | null
          created_at: string
          customer_id: string
          id: string
          monthly_value: number | null
          quote_id: string | null
          service_status: string
          signed: boolean | null
          signed_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_minimum_term?: boolean | null
          activated_at?: string | null
          client_ip?: string | null
          contract_hash?: string | null
          contract_pdf_path?: string | null
          contract_text?: string | null
          contract_type?: string | null
          created_at?: string
          customer_id: string
          id?: string
          monthly_value?: number | null
          quote_id?: string | null
          service_status?: string
          signed?: boolean | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_minimum_term?: boolean | null
          activated_at?: string | null
          client_ip?: string | null
          contract_hash?: string | null
          contract_pdf_path?: string | null
          contract_text?: string | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          monthly_value?: number | null
          quote_id?: string | null
          service_status?: string
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
          {
            foreignKeyName: "fk_contracts__customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contracts__quote"
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
          status_cliente: string
          suspended_at: string | null
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
          status_cliente?: string
          suspended_at?: string | null
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
          status_cliente?: string
          suspended_at?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fiscal_change_log: {
        Row: {
          change_source: string
          changed_at: string
          changed_by_process: string | null
          created_at: string
          field_name: string
          fiscal_document_id: string
          id: string
          new_value: string | null
          old_value: string | null
          related_event_history_id: string | null
        }
        Insert: {
          change_source?: string
          changed_at?: string
          changed_by_process?: string | null
          created_at?: string
          field_name: string
          fiscal_document_id: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          related_event_history_id?: string | null
        }
        Update: {
          change_source?: string
          changed_at?: string
          changed_by_process?: string | null
          created_at?: string
          field_name?: string
          fiscal_document_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          related_event_history_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_change_log_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_change_log_related_event_history_id_fkey"
            columns: ["related_event_history_id"]
            isOneToOne: false
            referencedRelation: "fiscal_event_history"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          access_key: string | null
          amount: number
          asaas_invoice_id: string | null
          contract_id: string | null
          created_at: string
          customer_id: string
          document_number: string | null
          document_type: string
          file_url: string | null
          id: string
          invoice_series: string | null
          is_active: boolean | null
          issue_date: string
          last_event_at: string | null
          last_event_source: string | null
          notes: string | null
          payment_id: string | null
          raw_payload: Json | null
          replaced_by_invoice_id: string | null
          service_reference: string | null
          status: string
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          amount?: number
          asaas_invoice_id?: string | null
          contract_id?: string | null
          created_at?: string
          customer_id: string
          document_number?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          invoice_series?: string | null
          is_active?: boolean | null
          issue_date?: string
          last_event_at?: string | null
          last_event_source?: string | null
          notes?: string | null
          payment_id?: string | null
          raw_payload?: Json | null
          replaced_by_invoice_id?: string | null
          service_reference?: string | null
          status?: string
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          amount?: number
          asaas_invoice_id?: string | null
          contract_id?: string | null
          created_at?: string
          customer_id?: string
          document_number?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          invoice_series?: string | null
          is_active?: boolean | null
          issue_date?: string
          last_event_at?: string | null
          last_event_source?: string | null
          notes?: string | null
          payment_id?: string | null
          raw_payload?: Json | null
          replaced_by_invoice_id?: string | null
          service_reference?: string | null
          status?: string
          updated_at?: string
          xml_url?: string | null
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
          {
            foreignKeyName: "fiscal_documents_replaced_by_invoice_id_fkey"
            columns: ["replaced_by_invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_event_history: {
        Row: {
          asaas_invoice_id: string | null
          correlation_id: string | null
          created_at: string
          created_by_process: string | null
          customer_id: string | null
          decision_reason: string | null
          event_source: string
          event_timestamp: string
          event_type: string
          fiscal_document_id: string | null
          id: string
          normalized_status: string | null
          overwrite_decision: string | null
          payload_snapshot: Json | null
          received_at: string
        }
        Insert: {
          asaas_invoice_id?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by_process?: string | null
          customer_id?: string | null
          decision_reason?: string | null
          event_source?: string
          event_timestamp?: string
          event_type: string
          fiscal_document_id?: string | null
          id?: string
          normalized_status?: string | null
          overwrite_decision?: string | null
          payload_snapshot?: Json | null
          received_at?: string
        }
        Update: {
          asaas_invoice_id?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by_process?: string | null
          customer_id?: string | null
          decision_reason?: string | null
          event_source?: string
          event_timestamp?: string
          event_type?: string
          fiscal_document_id?: string | null
          id?: string
          normalized_status?: string | null
          overwrite_decision?: string | null
          payload_snapshot?: Json | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_event_history_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
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
      invoice_files: {
        Row: {
          created_at: string
          file_url: string
          filename: string | null
          id: string
          invoice_id: string
          mime_type: string | null
          type: string
        }
        Insert: {
          created_at?: string
          file_url: string
          filename?: string | null
          id?: string
          invoice_id: string
          mime_type?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          file_url?: string
          filename?: string | null
          id?: string
          invoice_id?: string
          mime_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_files_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
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
      lp_contract_acceptances: {
        Row: {
          acceptance_method: string
          acceptance_type: Database["public"]["Enums"]["lp_acceptance_type"]
          accepted_at: string
          content_hash: string
          contract_id: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acceptance_method?: string
          acceptance_type?: Database["public"]["Enums"]["lp_acceptance_type"]
          accepted_at?: string
          content_hash: string
          contract_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acceptance_method?: string
          acceptance_type?: Database["public"]["Enums"]["lp_acceptance_type"]
          accepted_at?: string
          content_hash?: string
          contract_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_contract_acceptances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lp_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_contract_templates: {
        Row: {
          body: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          variables_schema: Json
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          variables_schema?: Json
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          variables_schema?: Json
          version?: number
        }
        Relationships: []
      }
      lp_contracts: {
        Row: {
          checkout_accepted_at: string | null
          contract_number: string
          created_at: string
          id: string
          order_id: string
          rendered_content: string | null
          signature_metadata: Json | null
          signed_at: string | null
          status: Database["public"]["Enums"]["lp_contract_status"]
          template_id: string | null
          template_snapshot: string | null
          template_version: number | null
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          checkout_accepted_at?: string | null
          contract_number?: string
          created_at?: string
          id?: string
          order_id: string
          rendered_content?: string | null
          signature_metadata?: Json | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["lp_contract_status"]
          template_id?: string | null
          template_snapshot?: string | null
          template_version?: number | null
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          checkout_accepted_at?: string | null
          contract_number?: string
          created_at?: string
          id?: string
          order_id?: string
          rendered_content?: string | null
          signature_metadata?: Json | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["lp_contract_status"]
          template_id?: string | null
          template_snapshot?: string | null
          template_version?: number | null
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_lp_contracts__order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lp_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lp_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "lp_contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          quantity: number
          service_id: string | null
          service_name_snapshot: string
          service_slug_snapshot: string
          subtotal_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          quantity?: number
          service_id?: string | null
          service_name_snapshot: string
          service_slug_snapshot: string
          subtotal_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          quantity?: number
          service_id?: string | null
          service_name_snapshot?: string
          service_slug_snapshot?: string
          subtotal_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_lp_order_items__order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lp_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lp_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "lp_services"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_number: string
          status: Database["public"]["Enums"]["lp_order_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["lp_order_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["lp_order_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lp_payment_providers: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          environment: Database["public"]["Enums"]["lp_provider_environment"]
          id: string
          is_active: boolean
          key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name: string
          environment?: Database["public"]["Enums"]["lp_provider_environment"]
          id?: string
          is_active?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          environment?: Database["public"]["Enums"]["lp_provider_environment"]
          id?: string
          is_active?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      lp_payments: {
        Row: {
          amount_cents: number
          created_at: string
          external_id: string | null
          id: string
          order_id: string
          paid_at: string | null
          payment_method: string | null
          provider: string
          provider_id: string | null
          raw_payload: Json | null
          status: Database["public"]["Enums"]["lp_payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          external_id?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method?: string | null
          provider: string
          provider_id?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["lp_payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          external_id?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method?: string | null
          provider?: string
          provider_id?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["lp_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lp_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_payments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lp_payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_service_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      lp_service_landing_pages: {
        Row: {
          blocks: Json
          created_at: string
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_published: boolean
          seo_description: string | null
          seo_title: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_service_landing_pages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "lp_services"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_services: {
        Row: {
          base_price_cents: number
          category_id: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          long_description: string | null
          name: string
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          category_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          long_description?: string | null
          name: string
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          category_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          long_description?: string | null
          name?: string
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lp_service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_webhook_events: {
        Row: {
          event_type: string
          external_event_id: string
          id: string
          order_id: string | null
          payment_id: string | null
          processed_at: string | null
          processing_error: string | null
          provider_key: string
          raw_payload: Json
          received_at: string
          signature: string | null
          status: Database["public"]["Enums"]["lp_webhook_event_status"]
        }
        Insert: {
          event_type: string
          external_event_id: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider_key: string
          raw_payload: Json
          received_at?: string
          signature?: string | null
          status?: Database["public"]["Enums"]["lp_webhook_event_status"]
        }
        Update: {
          event_type?: string
          external_event_id?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider_key?: string
          raw_payload?: Json
          received_at?: string
          signature?: string | null
          status?: Database["public"]["Enums"]["lp_webhook_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lp_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lp_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "lp_payments"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      qa_armamentos_catalogo: {
        Row: {
          alcance_efetivo_m: number | null
          apelido: string | null
          ativo: boolean
          calibre: string
          capacidade_carregador: number | null
          classificacao_legal: string | null
          comprimento_cano_mm: number | null
          created_at: string
          descricao: string | null
          fonte_dados: string
          fonte_url: string | null
          id: string
          imagem: string | null
          imagem_aprovada: boolean
          imagem_enviada_em: string | null
          imagem_enviada_por: string | null
          imagem_fonte: string | null
          imagem_gerada_em: string | null
          imagem_status: string
          imagem_url: string | null
          imagem_validacao_motivo: string | null
          imagem_validada_em: string | null
          imagens: string[]
          manual_url: string | null
          marca: string
          modelo: string
          observacoes: string | null
          origem: string | null
          peso_gramas: number | null
          revisado_em: string | null
          revisado_por: string | null
          search_tokens: string | null
          stat_alcance: number | null
          stat_cadencia: number | null
          stat_controle: number | null
          stat_dano: number | null
          stat_mobilidade: number | null
          stat_precisao: number | null
          status_revisao: string
          tem_fundo_transparente: boolean
          tipo: string
          updated_at: string
          velocidade_projetil_ms: number | null
        }
        Insert: {
          alcance_efetivo_m?: number | null
          apelido?: string | null
          ativo?: boolean
          calibre: string
          capacidade_carregador?: number | null
          classificacao_legal?: string | null
          comprimento_cano_mm?: number | null
          created_at?: string
          descricao?: string | null
          fonte_dados?: string
          fonte_url?: string | null
          id?: string
          imagem?: string | null
          imagem_aprovada?: boolean
          imagem_enviada_em?: string | null
          imagem_enviada_por?: string | null
          imagem_fonte?: string | null
          imagem_gerada_em?: string | null
          imagem_status?: string
          imagem_url?: string | null
          imagem_validacao_motivo?: string | null
          imagem_validada_em?: string | null
          imagens?: string[]
          manual_url?: string | null
          marca: string
          modelo: string
          observacoes?: string | null
          origem?: string | null
          peso_gramas?: number | null
          revisado_em?: string | null
          revisado_por?: string | null
          search_tokens?: string | null
          stat_alcance?: number | null
          stat_cadencia?: number | null
          stat_controle?: number | null
          stat_dano?: number | null
          stat_mobilidade?: number | null
          stat_precisao?: number | null
          status_revisao?: string
          tem_fundo_transparente?: boolean
          tipo: string
          updated_at?: string
          velocidade_projetil_ms?: number | null
        }
        Update: {
          alcance_efetivo_m?: number | null
          apelido?: string | null
          ativo?: boolean
          calibre?: string
          capacidade_carregador?: number | null
          classificacao_legal?: string | null
          comprimento_cano_mm?: number | null
          created_at?: string
          descricao?: string | null
          fonte_dados?: string
          fonte_url?: string | null
          id?: string
          imagem?: string | null
          imagem_aprovada?: boolean
          imagem_enviada_em?: string | null
          imagem_enviada_por?: string | null
          imagem_fonte?: string | null
          imagem_gerada_em?: string | null
          imagem_status?: string
          imagem_url?: string | null
          imagem_validacao_motivo?: string | null
          imagem_validada_em?: string | null
          imagens?: string[]
          manual_url?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          origem?: string | null
          peso_gramas?: number | null
          revisado_em?: string | null
          revisado_por?: string | null
          search_tokens?: string | null
          stat_alcance?: number | null
          stat_cadencia?: number | null
          stat_controle?: number | null
          stat_dano?: number | null
          stat_mobilidade?: number | null
          stat_precisao?: number | null
          status_revisao?: string
          tem_fundo_transparente?: boolean
          tipo?: string
          updated_at?: string
          velocidade_projetil_ms?: number | null
        }
        Relationships: []
      }
      qa_armamentos_validacao_logs: {
        Row: {
          confianca: number
          created_at: string
          id: string
          imagem_url: string
          item_id: string
          motivo: string | null
          validacao_resultado: string
          validado_em: string
        }
        Insert: {
          confianca: number
          created_at?: string
          id?: string
          imagem_url: string
          item_id: string
          motivo?: string | null
          validacao_resultado: string
          validado_em?: string
        }
        Update: {
          confianca?: number
          created_at?: string
          id?: string
          imagem_url?: string
          item_id?: string
          motivo?: string | null
          validacao_resultado?: string
          validado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_armamentos_validacao_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "qa_armamentos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_cadastro_cr: {
        Row: {
          check_exame_tiro: boolean | null
          check_laudo_psi: boolean | null
          cliente_id: number | null
          consolidado_em: string | null
          consolidado_motivo: string | null
          consolidado_por: string | null
          id: number
          id_legado: number | null
          num_item_servico_cr: number | null
          numero_cr: string | null
          senha_gov: string | null
          senha_gov_encrypted: string | null
          senha_gov_iv: string | null
          senha_gov_tag: string | null
          senha_gov_updated_at: string | null
          senha_gov_updated_by: string | null
          validade_cr: string | null
          validade_exame_tiro: string | null
          validade_laudo_psicologico: string | null
        }
        Insert: {
          check_exame_tiro?: boolean | null
          check_laudo_psi?: boolean | null
          cliente_id?: number | null
          consolidado_em?: string | null
          consolidado_motivo?: string | null
          consolidado_por?: string | null
          id?: number
          id_legado?: number | null
          num_item_servico_cr?: number | null
          numero_cr?: string | null
          senha_gov?: string | null
          senha_gov_encrypted?: string | null
          senha_gov_iv?: string | null
          senha_gov_tag?: string | null
          senha_gov_updated_at?: string | null
          senha_gov_updated_by?: string | null
          validade_cr?: string | null
          validade_exame_tiro?: string | null
          validade_laudo_psicologico?: string | null
        }
        Update: {
          check_exame_tiro?: boolean | null
          check_laudo_psi?: boolean | null
          cliente_id?: number | null
          consolidado_em?: string | null
          consolidado_motivo?: string | null
          consolidado_por?: string | null
          id?: number
          id_legado?: number | null
          num_item_servico_cr?: number | null
          numero_cr?: string | null
          senha_gov?: string | null
          senha_gov_encrypted?: string | null
          senha_gov_iv?: string | null
          senha_gov_tag?: string | null
          senha_gov_updated_at?: string | null
          senha_gov_updated_by?: string | null
          validade_cr?: string | null
          validade_exame_tiro?: string | null
          validade_laudo_psicologico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_cadastro_cr_audit: {
        Row: {
          cadastro_cr_id: number
          changed_by: string | null
          cliente_id_anterior: number | null
          cliente_id_novo: number | null
          contexto: string | null
          created_at: string
          id: number
        }
        Insert: {
          cadastro_cr_id: number
          changed_by?: string | null
          cliente_id_anterior?: number | null
          cliente_id_novo?: number | null
          contexto?: string | null
          created_at?: string
          id?: number
        }
        Update: {
          cadastro_cr_id?: number
          changed_by?: string | null
          cliente_id_anterior?: number | null
          cliente_id_novo?: number | null
          contexto?: string | null
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      qa_cadastro_cr_backup_p0: {
        Row: {
          backup_at: string | null
          check_exame_tiro: boolean | null
          check_laudo_psi: boolean | null
          cliente_id: number | null
          id: number | null
          id_legado: number | null
          num_item_servico_cr: number | null
          numero_cr: string | null
          senha_gov: string | null
          senha_gov_encrypted: string | null
          senha_gov_iv: string | null
          senha_gov_tag: string | null
          senha_gov_updated_at: string | null
          senha_gov_updated_by: string | null
          validade_cr: string | null
          validade_exame_tiro: string | null
          validade_laudo_psicologico: string | null
        }
        Insert: {
          backup_at?: string | null
          check_exame_tiro?: boolean | null
          check_laudo_psi?: boolean | null
          cliente_id?: number | null
          id?: number | null
          id_legado?: number | null
          num_item_servico_cr?: number | null
          numero_cr?: string | null
          senha_gov?: string | null
          senha_gov_encrypted?: string | null
          senha_gov_iv?: string | null
          senha_gov_tag?: string | null
          senha_gov_updated_at?: string | null
          senha_gov_updated_by?: string | null
          validade_cr?: string | null
          validade_exame_tiro?: string | null
          validade_laudo_psicologico?: string | null
        }
        Update: {
          backup_at?: string | null
          check_exame_tiro?: boolean | null
          check_laudo_psi?: boolean | null
          cliente_id?: number | null
          id?: number | null
          id_legado?: number | null
          num_item_servico_cr?: number | null
          numero_cr?: string | null
          senha_gov?: string | null
          senha_gov_encrypted?: string | null
          senha_gov_iv?: string | null
          senha_gov_tag?: string | null
          senha_gov_updated_at?: string | null
          senha_gov_updated_by?: string | null
          validade_cr?: string | null
          validade_exame_tiro?: string | null
          validade_laudo_psicologico?: string | null
        }
        Relationships: []
      }
      qa_cadastro_cr_consolidacao_snapshot: {
        Row: {
          check_exame_tiro: boolean | null
          check_laudo_psi: boolean | null
          cliente_id: number | null
          id: number | null
          id_legado: number | null
          num_item_servico_cr: number | null
          numero_cr: string | null
          senha_gov: string | null
          senha_gov_encrypted: string | null
          senha_gov_iv: string | null
          senha_gov_tag: string | null
          senha_gov_updated_at: string | null
          senha_gov_updated_by: string | null
          snapshot_em: string | null
          validade_cr: string | null
          validade_exame_tiro: string | null
          validade_laudo_psicologico: string | null
        }
        Insert: {
          check_exame_tiro?: boolean | null
          check_laudo_psi?: boolean | null
          cliente_id?: number | null
          id?: number | null
          id_legado?: number | null
          num_item_servico_cr?: number | null
          numero_cr?: string | null
          senha_gov?: string | null
          senha_gov_encrypted?: string | null
          senha_gov_iv?: string | null
          senha_gov_tag?: string | null
          senha_gov_updated_at?: string | null
          senha_gov_updated_by?: string | null
          snapshot_em?: string | null
          validade_cr?: string | null
          validade_exame_tiro?: string | null
          validade_laudo_psicologico?: string | null
        }
        Update: {
          check_exame_tiro?: boolean | null
          check_laudo_psi?: boolean | null
          cliente_id?: number | null
          id?: number | null
          id_legado?: number | null
          num_item_servico_cr?: number | null
          numero_cr?: string | null
          senha_gov?: string | null
          senha_gov_encrypted?: string | null
          senha_gov_iv?: string | null
          senha_gov_tag?: string | null
          senha_gov_updated_at?: string | null
          senha_gov_updated_by?: string | null
          snapshot_em?: string | null
          validade_cr?: string | null
          validade_exame_tiro?: string | null
          validade_laudo_psicologico?: string | null
        }
        Relationships: []
      }
      qa_cadastro_publico: {
        Row: {
          aguardando_cliente_desde: string | null
          aut_atividade: string | null
          aut_cnpj: string | null
          aut_endereco: string | null
          aut_nome_profissional: string | null
          aut_telefone: string | null
          categoria_servico: string | null
          categoria_titular: string | null
          cliente_id_vinculado: number | null
          cnh: string | null
          comprovante_endereco_path: string | null
          consentimento_dados_verdadeiros: boolean
          consentimento_ip: string | null
          consentimento_texto: string | null
          consentimento_timestamp: string | null
          consentimento_tratamento_dados: boolean
          consentimento_user_agent: string | null
          cpf: string
          created_at: string
          ctps: string | null
          data_expedicao_rg: string | null
          data_nascimento: string | null
          descricao_servico_livre: string | null
          dias_pausados: number
          documento_identidade_path: string | null
          email: string
          emissor_rg: string | null
          emp_cargo_funcao: string | null
          emp_cnae_principal: string | null
          emp_cnpj: string | null
          emp_data_abertura: string | null
          emp_email: string | null
          emp_endereco: string | null
          emp_natureza_juridica: string | null
          emp_nome_fantasia: string | null
          emp_participacao_societaria: string | null
          emp_razao_social: string | null
          emp_situacao_cadastral: string | null
          emp_telefone: string | null
          end1_bairro: string | null
          end1_cep: string | null
          end1_cidade: string | null
          end1_complemento: string | null
          end1_estado: string | null
          end1_latitude: string | null
          end1_logradouro: string | null
          end1_longitude: string | null
          end1_numero: string | null
          end1_pais: string | null
          end2_bairro: string | null
          end2_cep: string | null
          end2_cidade: string | null
          end2_complemento: string | null
          end2_estado: string | null
          end2_latitude: string | null
          end2_logradouro: string | null
          end2_longitude: string | null
          end2_numero: string | null
          end2_tipo: string | null
          estado_civil: string | null
          id: string
          motivo_recusa: string | null
          nacionalidade: string | null
          naturalidade_municipio: string | null
          naturalidade_pais: string | null
          naturalidade_uf: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          notas_processamento: string | null
          objetivo_principal: string | null
          observacoes: string | null
          origem_cadastro: string | null
          pago: boolean
          pago_em: string | null
          pis_pasep: string | null
          processado_em: string | null
          processado_por: string | null
          profissao: string | null
          rg: string | null
          selfie_path: string | null
          servico_fechado_final: string | null
          servico_interesse: string | null
          servico_principal: string | null
          sexo: string | null
          sla_concluido_em: string | null
          status: string
          subtipo_servico: string | null
          telefone_principal: string
          telefone_secundario: string | null
          tem_segundo_endereco: boolean | null
          titulo_eleitor: string | null
          trab_cargo_funcao: string | null
          trab_cnpj_empresa: string | null
          trab_data_admissao: string | null
          trab_endereco_empresa: string | null
          trab_faixa_salarial: string | null
          trab_nome_empresa: string | null
          trab_telefone_empresa: string | null
          uf_emissor_rg: string | null
          ultima_solicitacao_cliente: string | null
          updated_at: string
          vinculo_tipo: string | null
        }
        Insert: {
          aguardando_cliente_desde?: string | null
          aut_atividade?: string | null
          aut_cnpj?: string | null
          aut_endereco?: string | null
          aut_nome_profissional?: string | null
          aut_telefone?: string | null
          categoria_servico?: string | null
          categoria_titular?: string | null
          cliente_id_vinculado?: number | null
          cnh?: string | null
          comprovante_endereco_path?: string | null
          consentimento_dados_verdadeiros?: boolean
          consentimento_ip?: string | null
          consentimento_texto?: string | null
          consentimento_timestamp?: string | null
          consentimento_tratamento_dados?: boolean
          consentimento_user_agent?: string | null
          cpf: string
          created_at?: string
          ctps?: string | null
          data_expedicao_rg?: string | null
          data_nascimento?: string | null
          descricao_servico_livre?: string | null
          dias_pausados?: number
          documento_identidade_path?: string | null
          email: string
          emissor_rg?: string | null
          emp_cargo_funcao?: string | null
          emp_cnae_principal?: string | null
          emp_cnpj?: string | null
          emp_data_abertura?: string | null
          emp_email?: string | null
          emp_endereco?: string | null
          emp_natureza_juridica?: string | null
          emp_nome_fantasia?: string | null
          emp_participacao_societaria?: string | null
          emp_razao_social?: string | null
          emp_situacao_cadastral?: string | null
          emp_telefone?: string | null
          end1_bairro?: string | null
          end1_cep?: string | null
          end1_cidade?: string | null
          end1_complemento?: string | null
          end1_estado?: string | null
          end1_latitude?: string | null
          end1_logradouro?: string | null
          end1_longitude?: string | null
          end1_numero?: string | null
          end1_pais?: string | null
          end2_bairro?: string | null
          end2_cep?: string | null
          end2_cidade?: string | null
          end2_complemento?: string | null
          end2_estado?: string | null
          end2_latitude?: string | null
          end2_logradouro?: string | null
          end2_longitude?: string | null
          end2_numero?: string | null
          end2_tipo?: string | null
          estado_civil?: string | null
          id?: string
          motivo_recusa?: string | null
          nacionalidade?: string | null
          naturalidade_municipio?: string | null
          naturalidade_pais?: string | null
          naturalidade_uf?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          notas_processamento?: string | null
          objetivo_principal?: string | null
          observacoes?: string | null
          origem_cadastro?: string | null
          pago?: boolean
          pago_em?: string | null
          pis_pasep?: string | null
          processado_em?: string | null
          processado_por?: string | null
          profissao?: string | null
          rg?: string | null
          selfie_path?: string | null
          servico_fechado_final?: string | null
          servico_interesse?: string | null
          servico_principal?: string | null
          sexo?: string | null
          sla_concluido_em?: string | null
          status?: string
          subtipo_servico?: string | null
          telefone_principal: string
          telefone_secundario?: string | null
          tem_segundo_endereco?: boolean | null
          titulo_eleitor?: string | null
          trab_cargo_funcao?: string | null
          trab_cnpj_empresa?: string | null
          trab_data_admissao?: string | null
          trab_endereco_empresa?: string | null
          trab_faixa_salarial?: string | null
          trab_nome_empresa?: string | null
          trab_telefone_empresa?: string | null
          uf_emissor_rg?: string | null
          ultima_solicitacao_cliente?: string | null
          updated_at?: string
          vinculo_tipo?: string | null
        }
        Update: {
          aguardando_cliente_desde?: string | null
          aut_atividade?: string | null
          aut_cnpj?: string | null
          aut_endereco?: string | null
          aut_nome_profissional?: string | null
          aut_telefone?: string | null
          categoria_servico?: string | null
          categoria_titular?: string | null
          cliente_id_vinculado?: number | null
          cnh?: string | null
          comprovante_endereco_path?: string | null
          consentimento_dados_verdadeiros?: boolean
          consentimento_ip?: string | null
          consentimento_texto?: string | null
          consentimento_timestamp?: string | null
          consentimento_tratamento_dados?: boolean
          consentimento_user_agent?: string | null
          cpf?: string
          created_at?: string
          ctps?: string | null
          data_expedicao_rg?: string | null
          data_nascimento?: string | null
          descricao_servico_livre?: string | null
          dias_pausados?: number
          documento_identidade_path?: string | null
          email?: string
          emissor_rg?: string | null
          emp_cargo_funcao?: string | null
          emp_cnae_principal?: string | null
          emp_cnpj?: string | null
          emp_data_abertura?: string | null
          emp_email?: string | null
          emp_endereco?: string | null
          emp_natureza_juridica?: string | null
          emp_nome_fantasia?: string | null
          emp_participacao_societaria?: string | null
          emp_razao_social?: string | null
          emp_situacao_cadastral?: string | null
          emp_telefone?: string | null
          end1_bairro?: string | null
          end1_cep?: string | null
          end1_cidade?: string | null
          end1_complemento?: string | null
          end1_estado?: string | null
          end1_latitude?: string | null
          end1_logradouro?: string | null
          end1_longitude?: string | null
          end1_numero?: string | null
          end1_pais?: string | null
          end2_bairro?: string | null
          end2_cep?: string | null
          end2_cidade?: string | null
          end2_complemento?: string | null
          end2_estado?: string | null
          end2_latitude?: string | null
          end2_logradouro?: string | null
          end2_longitude?: string | null
          end2_numero?: string | null
          end2_tipo?: string | null
          estado_civil?: string | null
          id?: string
          motivo_recusa?: string | null
          nacionalidade?: string | null
          naturalidade_municipio?: string | null
          naturalidade_pais?: string | null
          naturalidade_uf?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          notas_processamento?: string | null
          objetivo_principal?: string | null
          observacoes?: string | null
          origem_cadastro?: string | null
          pago?: boolean
          pago_em?: string | null
          pis_pasep?: string | null
          processado_em?: string | null
          processado_por?: string | null
          profissao?: string | null
          rg?: string | null
          selfie_path?: string | null
          servico_fechado_final?: string | null
          servico_interesse?: string | null
          servico_principal?: string | null
          sexo?: string | null
          sla_concluido_em?: string | null
          status?: string
          subtipo_servico?: string | null
          telefone_principal?: string
          telefone_secundario?: string | null
          tem_segundo_endereco?: boolean | null
          titulo_eleitor?: string | null
          trab_cargo_funcao?: string | null
          trab_cnpj_empresa?: string | null
          trab_data_admissao?: string | null
          trab_endereco_empresa?: string | null
          trab_faixa_salarial?: string | null
          trab_nome_empresa?: string | null
          trab_telefone_empresa?: string | null
          uf_emissor_rg?: string | null
          ultima_solicitacao_cliente?: string | null
          updated_at?: string
          vinculo_tipo?: string | null
        }
        Relationships: []
      }
      qa_cadastro_publico_recusados: {
        Row: {
          cadastro_created_at: string | null
          cadastro_original_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          end1_cidade: string | null
          end1_estado: string | null
          id: string
          motivo_recusa: string | null
          nome_completo: string | null
          pago: boolean | null
          payload_original: Json | null
          recusado_em: string
          recusado_por: string | null
          servico_interesse: string | null
          telefone_principal: string | null
        }
        Insert: {
          cadastro_created_at?: string | null
          cadastro_original_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          end1_cidade?: string | null
          end1_estado?: string | null
          id?: string
          motivo_recusa?: string | null
          nome_completo?: string | null
          pago?: boolean | null
          payload_original?: Json | null
          recusado_em?: string
          recusado_por?: string | null
          servico_interesse?: string | null
          telefone_principal?: string | null
        }
        Update: {
          cadastro_created_at?: string | null
          cadastro_original_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          end1_cidade?: string | null
          end1_estado?: string | null
          id?: string
          motivo_recusa?: string | null
          nome_completo?: string | null
          pago?: boolean | null
          payload_original?: Json | null
          recusado_em?: string
          recusado_por?: string | null
          servico_interesse?: string | null
          telefone_principal?: string | null
        }
        Relationships: []
      }
      qa_cadastro_telemetria: {
        Row: {
          categoria_titular: string | null
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          payload: Json
          sessao_id: string | null
          user_agent_hash: string | null
        }
        Insert: {
          categoria_titular?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          sessao_id?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          categoria_titular?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          sessao_id?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      qa_casos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: number | null
          cpf_cnpj: string | null
          created_at: string
          descricao_caso: string | null
          documentos_auxiliares_json: Json | null
          docx_path: string | null
          endereco: string | null
          erros_documentos_json: Json | null
          foco_argumentativo: string | null
          geracao_id: string | null
          id: string
          minuta_gerada: string | null
          nome_requerente: string
          sigla_unidade_pf: string | null
          status: string
          tipo_peca: string | null
          tipo_servico: string | null
          titulo: string
          uf: string | null
          unidade_pf: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          descricao_caso?: string | null
          documentos_auxiliares_json?: Json | null
          docx_path?: string | null
          endereco?: string | null
          erros_documentos_json?: Json | null
          foco_argumentativo?: string | null
          geracao_id?: string | null
          id?: string
          minuta_gerada?: string | null
          nome_requerente?: string
          sigla_unidade_pf?: string | null
          status?: string
          tipo_peca?: string | null
          tipo_servico?: string | null
          titulo?: string
          uf?: string | null
          unidade_pf?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          descricao_caso?: string | null
          documentos_auxiliares_json?: Json | null
          docx_path?: string | null
          endereco?: string | null
          erros_documentos_json?: Json | null
          foco_argumentativo?: string | null
          geracao_id?: string | null
          id?: string
          minuta_gerada?: string | null
          nome_requerente?: string
          sigla_unidade_pf?: string | null
          status?: string
          tipo_peca?: string | null
          tipo_servico?: string | null
          titulo?: string
          uf?: string | null
          unidade_pf?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_casos__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_casos__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_casos__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_casos__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "qa_casos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_casos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_casos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_casos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_chunks_conhecimento: {
        Row: {
          created_at: string
          documento_id: string
          embedding_status: string
          id: string
          metadados_json: Json | null
          ordem_chunk: number
          resumo_chunk: string | null
          texto_chunk: string
        }
        Insert: {
          created_at?: string
          documento_id: string
          embedding_status?: string
          id?: string
          metadados_json?: Json | null
          ordem_chunk?: number
          resumo_chunk?: string | null
          texto_chunk: string
        }
        Update: {
          created_at?: string
          documento_id?: string
          embedding_status?: string
          id?: string
          metadados_json?: Json | null
          ordem_chunk?: number
          resumo_chunk?: string | null
          texto_chunk?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_chunks__documento"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "qa_documentos_conhecimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_chunks_conhecimento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "qa_documentos_conhecimento"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_circunscricoes_pf: {
        Row: {
          ato_normativo: string | null
          base_legal: string | null
          created_at: string
          id: string
          municipio_sede: string
          municipios_cobertos: string[]
          sigla_unidade: string | null
          tipo_unidade: string
          uf: string
          unidade_pf: string
          updated_at: string
        }
        Insert: {
          ato_normativo?: string | null
          base_legal?: string | null
          created_at?: string
          id?: string
          municipio_sede: string
          municipios_cobertos?: string[]
          sigla_unidade?: string | null
          tipo_unidade?: string
          uf: string
          unidade_pf: string
          updated_at?: string
        }
        Update: {
          ato_normativo?: string | null
          base_legal?: string | null
          created_at?: string
          id?: string
          municipio_sede?: string
          municipios_cobertos?: string[]
          sigla_unidade?: string | null
          tipo_unidade?: string
          uf?: string
          unidade_pf?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_cliente_armas_auditoria: {
        Row: {
          acao: string
          arma_manual_id: number
          ator_tipo: string
          campos_alterados: Json | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: number
          origem: string | null
          qa_cliente_id: number | null
          user_id: string | null
        }
        Insert: {
          acao: string
          arma_manual_id: number
          ator_tipo: string
          campos_alterados?: Json | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: number
          origem?: string | null
          qa_cliente_id?: number | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          arma_manual_id?: number
          ator_tipo?: string
          campos_alterados?: Json | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: number
          origem?: string | null
          qa_cliente_id?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      qa_cliente_armas_manual: {
        Row: {
          calibre: string | null
          created_at: string
          dados_extraidos_json: Json | null
          id: number
          marca: string | null
          modelo: string | null
          needs_review: boolean
          numero_autorizacao_compra: string | null
          numero_craf: string | null
          numero_serie: string | null
          numero_sigma: string | null
          numero_sinarm: string | null
          origem: string
          qa_cliente_id: number
          sistema: string | null
          status_documental: string | null
          tipo_arma: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calibre?: string | null
          created_at?: string
          dados_extraidos_json?: Json | null
          id?: number
          marca?: string | null
          modelo?: string | null
          needs_review?: boolean
          numero_autorizacao_compra?: string | null
          numero_craf?: string | null
          numero_serie?: string | null
          numero_sigma?: string | null
          numero_sinarm?: string | null
          origem?: string
          qa_cliente_id: number
          sistema?: string | null
          status_documental?: string | null
          tipo_arma?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calibre?: string | null
          created_at?: string
          dados_extraidos_json?: Json | null
          id?: number
          marca?: string | null
          modelo?: string | null
          needs_review?: boolean
          numero_autorizacao_compra?: string | null
          numero_craf?: string | null
          numero_serie?: string | null
          numero_sigma?: string | null
          numero_sinarm?: string | null
          origem?: string
          qa_cliente_id?: number
          sistema?: string | null
          status_documental?: string | null
          tipo_arma?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_cliente_armas_manual_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cliente_armas_manual_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cliente_armas_manual_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cliente_armas_manual_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_cliente_credenciais: {
        Row: {
          cadastro_cr_id: number | null
          cliente_id: number
          created_at: string
          id: number
          notas: string | null
          origem: string
          senha_encrypted: string
          senha_iv: string
          senha_tag: string
          status: string
          tipo_credencial: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cadastro_cr_id?: number | null
          cliente_id: number
          created_at?: string
          id?: number
          notas?: string | null
          origem: string
          senha_encrypted: string
          senha_iv: string
          senha_tag: string
          status?: string
          tipo_credencial?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cadastro_cr_id?: number | null
          cliente_id?: number
          created_at?: string
          id?: number
          notas?: string | null
          origem?: string
          senha_encrypted?: string
          senha_iv?: string
          senha_tag?: string
          status?: string
          tipo_credencial?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_cliente_credenciais_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_cadastro_cr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cadastro_cr_id_sugerido"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_incident_reconciliation_plan"
            referencedColumns: ["cadastro_cr_id"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_senha_gov_incident_audit"
            referencedColumns: ["cadastro_cr_id"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cliente_credenciais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_cliente_credenciais_audit: {
        Row: {
          acao: string
          cliente_id: number
          contexto: string | null
          created_at: string
          credencial_id: number | null
          id: number
          ip: string | null
          origem: string | null
          rollback_payload: Json | null
          status_resultado: string | null
          tipo_credencial: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          cliente_id: number
          contexto?: string | null
          created_at?: string
          credencial_id?: number | null
          id?: number
          ip?: string | null
          origem?: string | null
          rollback_payload?: Json | null
          status_resultado?: string | null
          tipo_credencial: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          cliente_id?: number
          contexto?: string | null
          created_at?: string
          credencial_id?: number | null
          id?: number
          ip?: string | null
          origem?: string | null
          rollback_payload?: Json | null
          status_resultado?: string | null
          tipo_credencial?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_cliente_credenciais_audit_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "qa_cliente_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_cliente_historico_atualizacoes: {
        Row: {
          autor: string | null
          cadastro_publico_id: string | null
          changed_fields: Json
          cliente_id: number
          created_at: string
          id: string
          origem: string
          snapshot_anterior: Json
          snapshot_novo: Json
        }
        Insert: {
          autor?: string | null
          cadastro_publico_id?: string | null
          changed_fields?: Json
          cliente_id: number
          created_at?: string
          id?: string
          origem?: string
          snapshot_anterior?: Json
          snapshot_novo?: Json
        }
        Update: {
          autor?: string | null
          cadastro_publico_id?: string | null
          changed_fields?: Json
          cliente_id?: number
          created_at?: string
          id?: string
          origem?: string
          snapshot_anterior?: Json
          snapshot_novo?: Json
        }
        Relationships: []
      }
      qa_cliente_homologacao_eventos: {
        Row: {
          ator: string
          created_at: string
          dados_json: Json
          descricao: string | null
          id: string
          qa_cliente_id: number
          tipo_evento: string
          user_id: string | null
        }
        Insert: {
          ator?: string
          created_at?: string
          dados_json?: Json
          descricao?: string | null
          id?: string
          qa_cliente_id: number
          tipo_evento: string
          user_id?: string | null
        }
        Update: {
          ator?: string
          created_at?: string
          dados_json?: Json
          descricao?: string | null
          id?: string
          qa_cliente_id?: number
          tipo_evento?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_cliente_homologacao_eventos_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cliente_homologacao_eventos_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cliente_homologacao_eventos_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cliente_homologacao_eventos_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_clientes: {
        Row: {
          avatar_tatico_gerado_em: string | null
          avatar_tatico_path: string | null
          bairro: string | null
          bairro2: string | null
          categoria_titular: string | null
          celular: string | null
          cep: string | null
          cep2: string | null
          cidade: string | null
          cidade2: string | null
          cliente_legado: boolean
          cliente_lions: boolean | null
          cnh: string | null
          complemento: string | null
          complemento2: string | null
          cpf: string | null
          created_at: string
          ctps: string | null
          customer_id: string | null
          data_nascimento: string | null
          email: string | null
          emissor_rg: string | null
          endereco: string | null
          endereco2: string | null
          escolaridade: string | null
          estado: string | null
          estado_civil: string | null
          estado2: string | null
          excluido: boolean | null
          expedicao_rg: string | null
          geolocalizacao: string | null
          geolocalizacao2: string | null
          homologacao_observacoes: string | null
          homologacao_status: string
          homologado_em: string | null
          homologado_por: string | null
          id: number
          id_legado: number
          imagem: string | null
          matricula_funcional: string | null
          nacionalidade: string | null
          naturalidade: string | null
          naturalidade_municipio: string | null
          naturalidade_pais: string | null
          naturalidade_uf: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          numero2: string | null
          observacao: string | null
          orgao_vinculado: string | null
          origem: string | null
          pais: string | null
          pais2: string | null
          pis_pasep: string | null
          profissao: string | null
          recadastramento_concluido_em: string | null
          recadastramento_iniciado_em: string | null
          recadastramento_obrigatorio: boolean
          recadastramento_status: string | null
          rg: string | null
          sexo: string | null
          status: string | null
          subcategoria: string | null
          tentativa_compra_legado_count: number
          tentativa_compra_legado_em: string | null
          tipo_cliente: string | null
          titulo_eleitor: string | null
          uf_emissor_rg: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_tatico_gerado_em?: string | null
          avatar_tatico_path?: string | null
          bairro?: string | null
          bairro2?: string | null
          categoria_titular?: string | null
          celular?: string | null
          cep?: string | null
          cep2?: string | null
          cidade?: string | null
          cidade2?: string | null
          cliente_legado?: boolean
          cliente_lions?: boolean | null
          cnh?: string | null
          complemento?: string | null
          complemento2?: string | null
          cpf?: string | null
          created_at?: string
          ctps?: string | null
          customer_id?: string | null
          data_nascimento?: string | null
          email?: string | null
          emissor_rg?: string | null
          endereco?: string | null
          endereco2?: string | null
          escolaridade?: string | null
          estado?: string | null
          estado_civil?: string | null
          estado2?: string | null
          excluido?: boolean | null
          expedicao_rg?: string | null
          geolocalizacao?: string | null
          geolocalizacao2?: string | null
          homologacao_observacoes?: string | null
          homologacao_status?: string
          homologado_em?: string | null
          homologado_por?: string | null
          id?: number
          id_legado: number
          imagem?: string | null
          matricula_funcional?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          naturalidade_municipio?: string | null
          naturalidade_pais?: string | null
          naturalidade_uf?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          numero2?: string | null
          observacao?: string | null
          orgao_vinculado?: string | null
          origem?: string | null
          pais?: string | null
          pais2?: string | null
          pis_pasep?: string | null
          profissao?: string | null
          recadastramento_concluido_em?: string | null
          recadastramento_iniciado_em?: string | null
          recadastramento_obrigatorio?: boolean
          recadastramento_status?: string | null
          rg?: string | null
          sexo?: string | null
          status?: string | null
          subcategoria?: string | null
          tentativa_compra_legado_count?: number
          tentativa_compra_legado_em?: string | null
          tipo_cliente?: string | null
          titulo_eleitor?: string | null
          uf_emissor_rg?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_tatico_gerado_em?: string | null
          avatar_tatico_path?: string | null
          bairro?: string | null
          bairro2?: string | null
          categoria_titular?: string | null
          celular?: string | null
          cep?: string | null
          cep2?: string | null
          cidade?: string | null
          cidade2?: string | null
          cliente_legado?: boolean
          cliente_lions?: boolean | null
          cnh?: string | null
          complemento?: string | null
          complemento2?: string | null
          cpf?: string | null
          created_at?: string
          ctps?: string | null
          customer_id?: string | null
          data_nascimento?: string | null
          email?: string | null
          emissor_rg?: string | null
          endereco?: string | null
          endereco2?: string | null
          escolaridade?: string | null
          estado?: string | null
          estado_civil?: string | null
          estado2?: string | null
          excluido?: boolean | null
          expedicao_rg?: string | null
          geolocalizacao?: string | null
          geolocalizacao2?: string | null
          homologacao_observacoes?: string | null
          homologacao_status?: string
          homologado_em?: string | null
          homologado_por?: string | null
          id?: number
          id_legado?: number
          imagem?: string | null
          matricula_funcional?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          naturalidade_municipio?: string | null
          naturalidade_pais?: string | null
          naturalidade_uf?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          numero2?: string | null
          observacao?: string | null
          orgao_vinculado?: string | null
          origem?: string | null
          pais?: string | null
          pais2?: string | null
          pis_pasep?: string | null
          profissao?: string | null
          recadastramento_concluido_em?: string | null
          recadastramento_iniciado_em?: string | null
          recadastramento_obrigatorio?: boolean
          recadastramento_status?: string | null
          rg?: string | null
          sexo?: string | null
          status?: string | null
          subcategoria?: string | null
          tentativa_compra_legado_count?: number
          tentativa_compra_legado_em?: string | null
          tipo_cliente?: string | null
          titulo_eleitor?: string | null
          uf_emissor_rg?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_clientes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_clubes: {
        Row: {
          cnpj: string | null
          data_validade: string | null
          endereco: string | null
          id: number
          id_legado: number | null
          nome_clube: string
          numero_cr: string | null
        }
        Insert: {
          cnpj?: string | null
          data_validade?: string | null
          endereco?: string | null
          id?: number
          id_legado?: number | null
          nome_clube: string
          numero_cr?: string | null
        }
        Update: {
          cnpj?: string | null
          data_validade?: string | null
          endereco?: string | null
          id?: number
          id_legado?: number | null
          nome_clube?: string
          numero_cr?: string | null
        }
        Relationships: []
      }
      qa_config: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      qa_consultas_ia: {
        Row: {
          caso_resumo: string | null
          caso_titulo: string | null
          created_at: string
          entrada_usuario: string
          filtros_aplicados_json: Json | null
          foco: string | null
          fontes_recuperadas_json: Json | null
          id: string
          observacoes_ia: string | null
          profundidade: string | null
          resposta_ia: string | null
          score_confianca: number | null
          tipo_peca: string | null
          tom: string | null
          usuario_id: string
        }
        Insert: {
          caso_resumo?: string | null
          caso_titulo?: string | null
          created_at?: string
          entrada_usuario: string
          filtros_aplicados_json?: Json | null
          foco?: string | null
          fontes_recuperadas_json?: Json | null
          id?: string
          observacoes_ia?: string | null
          profundidade?: string | null
          resposta_ia?: string | null
          score_confianca?: number | null
          tipo_peca?: string | null
          tom?: string | null
          usuario_id: string
        }
        Update: {
          caso_resumo?: string | null
          caso_titulo?: string | null
          created_at?: string
          entrada_usuario?: string
          filtros_aplicados_json?: Json | null
          foco?: string | null
          fontes_recuperadas_json?: Json | null
          id?: string
          observacoes_ia?: string | null
          profundidade?: string | null
          resposta_ia?: string | null
          score_confianca?: number | null
          tipo_peca?: string | null
          tom?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      qa_crafs: {
        Row: {
          catalogo_id: string | null
          cliente_id: number | null
          data_validade: string | null
          id: number
          id_legado: number | null
          nome_arma: string | null
          nome_craf: string | null
          numero_arma: string | null
          numero_sigma: string | null
        }
        Insert: {
          catalogo_id?: string | null
          cliente_id?: number | null
          data_validade?: string | null
          id?: number
          id_legado?: number | null
          nome_arma?: string | null
          nome_craf?: string | null
          numero_arma?: string | null
          numero_sigma?: string | null
        }
        Update: {
          catalogo_id?: string | null
          cliente_id?: number | null
          data_validade?: string | null
          id?: number
          id_legado?: number | null
          nome_arma?: string | null
          nome_craf?: string | null
          numero_arma?: string | null
          numero_sigma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_crafs__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_crafs__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_crafs__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_crafs__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "qa_crafs_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "qa_armamentos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_dashboard_kpi_layout: {
        Row: {
          cliente_id: number | null
          created_at: string
          dashboard_type: string
          id: string
          kpi_order: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string
          dashboard_type?: string
          id?: string
          kpi_order: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: number | null
          created_at?: string
          dashboard_type?: string
          id?: string
          kpi_order?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_document_examples: {
        Row: {
          arquivo_url: string
          ativo: boolean
          created_at: string
          criado_por: string | null
          descricao: string | null
          exemplo_valido: boolean
          id: string
          observacoes: string | null
          servico_id: number | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          arquivo_url: string
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          exemplo_valido?: boolean
          id?: string
          observacoes?: string | null
          servico_id?: number | null
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          exemplo_valido?: boolean
          id?: string
          observacoes?: string | null
          servico_id?: number | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_document_examples_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "qa_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_document_external_links: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          id: string
          nome_botao: string
          ordem: number
          tipo_documento: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome_botao: string
          ordem?: number
          tipo_documento: string
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome_botao?: string
          ordem?: number
          tipo_documento?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      qa_document_jobs: {
        Row: {
          caso_id: string | null
          created_at: string
          documento_id: string | null
          erro: string | null
          etapa_atual: string | null
          finished_at: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string | null
          started_at: string | null
          status: string
          storage_path: string | null
          tamanho_bytes: number | null
          tentativas: number
          tipo_documental: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          caso_id?: string | null
          created_at?: string
          documento_id?: string | null
          erro?: string | null
          etapa_atual?: string | null
          finished_at?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tentativas?: number
          tipo_documental?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          caso_id?: string | null
          created_at?: string
          documento_id?: string | null
          erro?: string | null
          etapa_atual?: string | null
          finished_at?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tentativas?: number
          tipo_documental?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      qa_documentos_cliente: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          arma_calibre: string | null
          arma_especie: string | null
          arma_marca: string | null
          arma_modelo: string | null
          arma_numero_serie: string | null
          arquivo_mime: string | null
          arquivo_nome: string | null
          arquivo_storage_path: string | null
          created_at: string
          customer_id: string | null
          data_emissao: string | null
          data_validade: string | null
          ia_dados_extraidos: Json | null
          ia_processado_em: string | null
          ia_status: string
          id: string
          motivo_reprovacao: string | null
          numero_documento: string | null
          observacoes: string | null
          orgao_emissor: string | null
          origem: string
          qa_cliente_id: number | null
          reprovado_em: string | null
          reprovado_por: string | null
          status: string
          tipo_documento: string
          updated_at: string
          validado_admin: boolean
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          arma_calibre?: string | null
          arma_especie?: string | null
          arma_marca?: string | null
          arma_modelo?: string | null
          arma_numero_serie?: string | null
          arquivo_mime?: string | null
          arquivo_nome?: string | null
          arquivo_storage_path?: string | null
          created_at?: string
          customer_id?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          ia_dados_extraidos?: Json | null
          ia_processado_em?: string | null
          ia_status?: string
          id?: string
          motivo_reprovacao?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          origem?: string
          qa_cliente_id?: number | null
          reprovado_em?: string | null
          reprovado_por?: string | null
          status?: string
          tipo_documento: string
          updated_at?: string
          validado_admin?: boolean
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          arma_calibre?: string | null
          arma_especie?: string | null
          arma_marca?: string | null
          arma_modelo?: string | null
          arma_numero_serie?: string | null
          arquivo_mime?: string | null
          arquivo_nome?: string | null
          arquivo_storage_path?: string | null
          created_at?: string
          customer_id?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          ia_dados_extraidos?: Json | null
          ia_processado_em?: string | null
          ia_status?: string
          id?: string
          motivo_reprovacao?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          origem?: string
          qa_cliente_id?: number | null
          reprovado_em?: string | null
          reprovado_por?: string | null
          status?: string
          tipo_documento?: string
          updated_at?: string
          validado_admin?: boolean
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_doc_cliente__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_doc_cliente__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_doc_cliente__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_doc_cliente__qa_cliente"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "qa_documentos_cliente_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_documentos_cliente_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_documentos_cliente_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_documentos_cliente_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_documentos_cliente_qa_cliente_id_fkey"
            columns: ["qa_cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_documentos_conhecimento: {
        Row: {
          ativo: boolean
          ativo_na_ia: boolean
          caso_id: string | null
          categoria: string | null
          created_at: string
          descricao: string | null
          enviado_por: string | null
          hash_arquivo: string | null
          id: string
          metadados_json: Json | null
          metodo_extracao: string | null
          mime_type: string | null
          nome_arquivo: string
          origem: string | null
          papel_documento: string
          referencia_preferencial: boolean
          resumo_extraido: string | null
          status_processamento: string
          status_validacao: string
          storage_path: string
          tamanho_bytes: number | null
          texto_extraido: string | null
          tipo_documento: string
          tipo_origem: string
          titulo: string
          updated_at: string
          url_origem: string | null
        }
        Insert: {
          ativo?: boolean
          ativo_na_ia?: boolean
          caso_id?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por?: string | null
          hash_arquivo?: string | null
          id?: string
          metadados_json?: Json | null
          metodo_extracao?: string | null
          mime_type?: string | null
          nome_arquivo: string
          origem?: string | null
          papel_documento?: string
          referencia_preferencial?: boolean
          resumo_extraido?: string | null
          status_processamento?: string
          status_validacao?: string
          storage_path: string
          tamanho_bytes?: number | null
          texto_extraido?: string | null
          tipo_documento?: string
          tipo_origem?: string
          titulo: string
          updated_at?: string
          url_origem?: string | null
        }
        Update: {
          ativo?: boolean
          ativo_na_ia?: boolean
          caso_id?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por?: string | null
          hash_arquivo?: string | null
          id?: string
          metadados_json?: Json | null
          metodo_extracao?: string | null
          mime_type?: string | null
          nome_arquivo?: string
          origem?: string | null
          papel_documento?: string
          referencia_preferencial?: boolean
          resumo_extraido?: string | null
          status_processamento?: string
          status_validacao?: string
          storage_path?: string
          tamanho_bytes?: number | null
          texto_extraido?: string | null
          tipo_documento?: string
          tipo_origem?: string
          titulo?: string
          updated_at?: string
          url_origem?: string | null
        }
        Relationships: []
      }
      qa_embeddings: {
        Row: {
          chunk_id: string
          created_at: string
          id: string
          modelo_embedding: string
          vetor_embedding: string | null
        }
        Insert: {
          chunk_id: string
          created_at?: string
          id?: string
          modelo_embedding?: string
          vetor_embedding?: string | null
        }
        Update: {
          chunk_id?: string
          created_at?: string
          id?: string
          modelo_embedding?: string
          vetor_embedding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_embeddings__chunk"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "qa_chunks_conhecimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "qa_chunks_conhecimento"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_exames_alertas_enviados: {
        Row: {
          canal: string
          detalhes: Json | null
          enviado_em: string
          exame_id: string
          id: string
          marco_dias: number
        }
        Insert: {
          canal: string
          detalhes?: Json | null
          enviado_em?: string
          exame_id: string
          id?: string
          marco_dias: number
        }
        Update: {
          canal?: string
          detalhes?: Json | null
          enviado_em?: string
          exame_id?: string
          id?: string
          marco_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_exames_alertas_enviados_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "qa_exames_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_exames_alertas_enviados_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "qa_exames_cliente_status"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_exames_cliente: {
        Row: {
          cadastrado_por: string | null
          cadastrado_por_nome: string | null
          cliente_id: number
          created_at: string
          data_realizacao: string
          data_vencimento: string
          id: string
          observacoes: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cadastrado_por?: string | null
          cadastrado_por_nome?: string | null
          cliente_id: number
          created_at?: string
          data_realizacao: string
          data_vencimento: string
          id?: string
          observacoes?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          cadastrado_por?: string | null
          cadastrado_por_nome?: string | null
          cliente_id?: number
          created_at?: string
          data_realizacao?: string
          data_vencimento?: string
          id?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_feedback_geracoes: {
        Row: {
          aprovada_como_modelo: boolean
          classificacao_aprendizado: string | null
          correcao_humana: string | null
          created_at: string
          geracao_id: string
          id: string
          incorporada_aprendizado: boolean | null
          incorporada_em: string | null
          observacoes: string | null
          peso_aprendizado: number | null
          resultado_pratico: string | null
          status_feedback: string
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          aprovada_como_modelo?: boolean
          classificacao_aprendizado?: string | null
          correcao_humana?: string | null
          created_at?: string
          geracao_id: string
          id?: string
          incorporada_aprendizado?: boolean | null
          incorporada_em?: string | null
          observacoes?: string | null
          peso_aprendizado?: number | null
          resultado_pratico?: string | null
          status_feedback?: string
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          aprovada_como_modelo?: boolean
          classificacao_aprendizado?: string | null
          correcao_humana?: string | null
          created_at?: string
          geracao_id?: string
          id?: string
          incorporada_aprendizado?: boolean | null
          incorporada_em?: string | null
          observacoes?: string | null
          peso_aprendizado?: number | null
          resultado_pratico?: string | null
          status_feedback?: string
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_feedback_geracoes_geracao_id_fkey"
            columns: ["geracao_id"]
            isOneToOne: false
            referencedRelation: "qa_geracoes_pecas"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_filiacoes: {
        Row: {
          cliente_id: number | null
          clube_id: number | null
          id: number
          id_legado: number | null
          nome_filiacao: string | null
          numero_filiacao: string | null
          validade_filiacao: string | null
        }
        Insert: {
          cliente_id?: number | null
          clube_id?: number | null
          id?: number
          id_legado?: number | null
          nome_filiacao?: string | null
          numero_filiacao?: string | null
          validade_filiacao?: string | null
        }
        Update: {
          cliente_id?: number | null
          clube_id?: number | null
          id?: number
          id_legado?: number | null
          nome_filiacao?: string | null
          numero_filiacao?: string | null
          validade_filiacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_filiacoes__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_filiacoes__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_filiacoes__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_filiacoes__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_fontes_normativas: {
        Row: {
          ano_norma: number | null
          ativa: boolean
          created_at: string
          data_publicacao: string | null
          data_vigencia: string | null
          ementa: string | null
          hash_conteudo: string | null
          id: string
          numero_norma: string | null
          orgao_emissor: string | null
          origem: string | null
          palavras_chave: string[] | null
          revisada_humanamente: boolean
          texto_integral: string | null
          tipo_norma: string
          titulo_norma: string
          updated_at: string
        }
        Insert: {
          ano_norma?: number | null
          ativa?: boolean
          created_at?: string
          data_publicacao?: string | null
          data_vigencia?: string | null
          ementa?: string | null
          hash_conteudo?: string | null
          id?: string
          numero_norma?: string | null
          orgao_emissor?: string | null
          origem?: string | null
          palavras_chave?: string[] | null
          revisada_humanamente?: boolean
          texto_integral?: string | null
          tipo_norma?: string
          titulo_norma: string
          updated_at?: string
        }
        Update: {
          ano_norma?: number | null
          ativa?: boolean
          created_at?: string
          data_publicacao?: string | null
          data_vigencia?: string | null
          ementa?: string | null
          hash_conteudo?: string | null
          id?: string
          numero_norma?: string | null
          orgao_emissor?: string | null
          origem?: string | null
          palavras_chave?: string[] | null
          revisada_humanamente?: boolean
          texto_integral?: string | null
          tipo_norma?: string
          titulo_norma?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_geracoes_pecas: {
        Row: {
          caso_id: string | null
          cliente_id: number | null
          created_at: string
          documentos_referencia_json: Json | null
          docx_path: string | null
          entrada_caso: string | null
          foco: string | null
          fundamentos_utilizados_json: Json | null
          id: string
          jurisprudencias_utilizadas_json: Json | null
          minuta_gerada: string | null
          normas_utilizadas_json: Json | null
          profundidade: string | null
          score_confianca: number | null
          status: string
          status_revisao: string | null
          tipo_peca: string
          titulo_geracao: string
          tom: string | null
          updated_at: string
          usuario_id: string
          versao: number
        }
        Insert: {
          caso_id?: string | null
          cliente_id?: number | null
          created_at?: string
          documentos_referencia_json?: Json | null
          docx_path?: string | null
          entrada_caso?: string | null
          foco?: string | null
          fundamentos_utilizados_json?: Json | null
          id?: string
          jurisprudencias_utilizadas_json?: Json | null
          minuta_gerada?: string | null
          normas_utilizadas_json?: Json | null
          profundidade?: string | null
          score_confianca?: number | null
          status?: string
          status_revisao?: string | null
          tipo_peca: string
          titulo_geracao: string
          tom?: string | null
          updated_at?: string
          usuario_id: string
          versao?: number
        }
        Update: {
          caso_id?: string | null
          cliente_id?: number | null
          created_at?: string
          documentos_referencia_json?: Json | null
          docx_path?: string | null
          entrada_caso?: string | null
          foco?: string | null
          fundamentos_utilizados_json?: Json | null
          id?: string
          jurisprudencias_utilizadas_json?: Json | null
          minuta_gerada?: string | null
          normas_utilizadas_json?: Json | null
          profundidade?: string | null
          score_confianca?: number | null
          status?: string
          status_revisao?: string | null
          tipo_peca?: string
          titulo_geracao?: string
          tom?: string | null
          updated_at?: string
          usuario_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_geracoes_pecas_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "qa_casos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_geracoes_pecas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_geracoes_pecas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_geracoes_pecas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_geracoes_pecas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_gov_reconciliation_audit: {
        Row: {
          acao: string
          cadastro_cr_id_anterior: number | null
          cadastro_cr_id_correto: number | null
          cliente_id_anterior: number | null
          cliente_id_correto: number | null
          cpf_normalizado: string | null
          email_normalizado: string | null
          evidencia: Json | null
          executado_em: string
          executado_por: string | null
          id: string
          motivo: string | null
          nivel_confianca: string
          numero_cr_normalizado: string | null
          origem: string
          rollback_payload: Json | null
          status: string
        }
        Insert: {
          acao: string
          cadastro_cr_id_anterior?: number | null
          cadastro_cr_id_correto?: number | null
          cliente_id_anterior?: number | null
          cliente_id_correto?: number | null
          cpf_normalizado?: string | null
          email_normalizado?: string | null
          evidencia?: Json | null
          executado_em?: string
          executado_por?: string | null
          id?: string
          motivo?: string | null
          nivel_confianca: string
          numero_cr_normalizado?: string | null
          origem?: string
          rollback_payload?: Json | null
          status: string
        }
        Update: {
          acao?: string
          cadastro_cr_id_anterior?: number | null
          cadastro_cr_id_correto?: number | null
          cliente_id_anterior?: number | null
          cliente_id_correto?: number | null
          cpf_normalizado?: string | null
          email_normalizado?: string | null
          evidencia?: Json | null
          executado_em?: string
          executado_por?: string | null
          id?: string
          motivo?: string | null
          nivel_confianca?: string
          numero_cr_normalizado?: string | null
          origem?: string
          rollback_payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      qa_gtes: {
        Row: {
          catalogo_id: string | null
          cliente_id: number | null
          data_validade: string | null
          id: number
          id_legado: number | null
          nome_arma: string | null
          nome_gte: string | null
          numero_arma: string | null
          numero_sigma: string | null
        }
        Insert: {
          catalogo_id?: string | null
          cliente_id?: number | null
          data_validade?: string | null
          id?: number
          id_legado?: number | null
          nome_arma?: string | null
          nome_gte?: string | null
          numero_arma?: string | null
          numero_sigma?: string | null
        }
        Update: {
          catalogo_id?: string | null
          cliente_id?: number | null
          data_validade?: string | null
          id?: number
          id_legado?: number | null
          nome_arma?: string | null
          nome_gte?: string | null
          numero_arma?: string | null
          numero_sigma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_gtes_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "qa_armamentos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_incident_reconciliation_snapshot: {
        Row: {
          cadastro_cr_id: number | null
          cifrado_em: string | null
          cliente_atual_cpf: string | null
          cliente_atual_id: number | null
          cliente_atual_nome: string | null
          cliente_correto_cpf: string | null
          cliente_correto_id: number | null
          cliente_correto_nome: string | null
          numero_cr: string | null
          senha_alterada_em: string | null
          snapshot_at: string | null
          status_reconciliacao: string | null
        }
        Insert: {
          cadastro_cr_id?: number | null
          cifrado_em?: string | null
          cliente_atual_cpf?: string | null
          cliente_atual_id?: number | null
          cliente_atual_nome?: string | null
          cliente_correto_cpf?: string | null
          cliente_correto_id?: number | null
          cliente_correto_nome?: string | null
          numero_cr?: string | null
          senha_alterada_em?: string | null
          snapshot_at?: string | null
          status_reconciliacao?: string | null
        }
        Update: {
          cadastro_cr_id?: number | null
          cifrado_em?: string | null
          cliente_atual_cpf?: string | null
          cliente_atual_id?: number | null
          cliente_atual_nome?: string | null
          cliente_correto_cpf?: string | null
          cliente_correto_id?: number | null
          cliente_correto_nome?: string | null
          numero_cr?: string | null
          senha_alterada_em?: string | null
          snapshot_at?: string | null
          status_reconciliacao?: string | null
        }
        Relationships: []
      }
      qa_itens_venda: {
        Row: {
          calibre: string | null
          cortesia: boolean
          cortesia_motivo: string | null
          data_deferimento: string | null
          data_indeferimento: string | null
          data_indeferimento_recurso: string | null
          data_notificacao: string | null
          data_protocolo: string | null
          data_recurso_administrativo: string | null
          data_ultima_atualizacao: string | null
          data_vencimento: string | null
          fabricante: string | null
          id: number
          id_legado: number | null
          modelo: string | null
          numero_autorizacao: string | null
          numero_cr: string | null
          numero_craf: string | null
          numero_gte: string | null
          numero_porte: string | null
          numero_posse: string | null
          numero_processo: string | null
          numero_registro: string | null
          numero_requerimento: string | null
          numero_serie: string | null
          numero_sigma: string | null
          numero_sinarm: string | null
          quantidade_tiros: string | null
          registro_cad: string | null
          servico_id: number | null
          sort_order: number | null
          status: string
          validade_autorizacao: string | null
          valor: number
          venda_id: number
        }
        Insert: {
          calibre?: string | null
          cortesia?: boolean
          cortesia_motivo?: string | null
          data_deferimento?: string | null
          data_indeferimento?: string | null
          data_indeferimento_recurso?: string | null
          data_notificacao?: string | null
          data_protocolo?: string | null
          data_recurso_administrativo?: string | null
          data_ultima_atualizacao?: string | null
          data_vencimento?: string | null
          fabricante?: string | null
          id?: number
          id_legado?: number | null
          modelo?: string | null
          numero_autorizacao?: string | null
          numero_cr?: string | null
          numero_craf?: string | null
          numero_gte?: string | null
          numero_porte?: string | null
          numero_posse?: string | null
          numero_processo?: string | null
          numero_registro?: string | null
          numero_requerimento?: string | null
          numero_serie?: string | null
          numero_sigma?: string | null
          numero_sinarm?: string | null
          quantidade_tiros?: string | null
          registro_cad?: string | null
          servico_id?: number | null
          sort_order?: number | null
          status?: string
          validade_autorizacao?: string | null
          valor?: number
          venda_id: number
        }
        Update: {
          calibre?: string | null
          cortesia?: boolean
          cortesia_motivo?: string | null
          data_deferimento?: string | null
          data_indeferimento?: string | null
          data_indeferimento_recurso?: string | null
          data_notificacao?: string | null
          data_protocolo?: string | null
          data_recurso_administrativo?: string | null
          data_ultima_atualizacao?: string | null
          data_vencimento?: string | null
          fabricante?: string | null
          id?: number
          id_legado?: number | null
          modelo?: string | null
          numero_autorizacao?: string | null
          numero_cr?: string | null
          numero_craf?: string | null
          numero_gte?: string | null
          numero_porte?: string | null
          numero_posse?: string | null
          numero_processo?: string | null
          numero_registro?: string | null
          numero_requerimento?: string | null
          numero_serie?: string | null
          numero_sigma?: string | null
          numero_sinarm?: string | null
          quantidade_tiros?: string | null
          registro_cad?: string | null
          servico_id?: number | null
          sort_order?: number | null
          status?: string
          validade_autorizacao?: string | null
          valor?: number
          venda_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_itens_venda__servico"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "qa_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_itens_venda__venda_legado"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "qa_vendas"
            referencedColumns: ["id_legado"]
          },
          {
            foreignKeyName: "qa_itens_venda_venda_id_fk"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "qa_vendas"
            referencedColumns: ["id_legado"]
          },
        ]
      }
      qa_itens_venda_orfaos: {
        Row: {
          id: number
          motivo: string
          movido_em: string
          payload: Json
        }
        Insert: {
          id?: number
          motivo?: string
          movido_em?: string
          payload: Json
        }
        Update: {
          id?: number
          motivo?: string
          movido_em?: string
          payload?: Json
        }
        Relationships: []
      }
      qa_jurisprudencias: {
        Row: {
          arquivo_url: string | null
          categoria_tematica: string | null
          created_at: string
          data_julgamento: string | null
          data_publicacao: string | null
          ementa_resumida: string | null
          id: string
          link_fonte: string | null
          numero_processo: string | null
          orgao_julgador: string | null
          origem: string | null
          palavras_chave: string[] | null
          relator: string | null
          tema: string | null
          tese_aplicavel: string | null
          texto_controlado: string | null
          tribunal: string
          updated_at: string
          validada_humanamente: boolean
        }
        Insert: {
          arquivo_url?: string | null
          categoria_tematica?: string | null
          created_at?: string
          data_julgamento?: string | null
          data_publicacao?: string | null
          ementa_resumida?: string | null
          id?: string
          link_fonte?: string | null
          numero_processo?: string | null
          orgao_julgador?: string | null
          origem?: string | null
          palavras_chave?: string[] | null
          relator?: string | null
          tema?: string | null
          tese_aplicavel?: string | null
          texto_controlado?: string | null
          tribunal: string
          updated_at?: string
          validada_humanamente?: boolean
        }
        Update: {
          arquivo_url?: string | null
          categoria_tematica?: string | null
          created_at?: string
          data_julgamento?: string | null
          data_publicacao?: string | null
          ementa_resumida?: string | null
          id?: string
          link_fonte?: string | null
          numero_processo?: string | null
          orgao_julgador?: string | null
          origem?: string | null
          palavras_chave?: string[] | null
          relator?: string | null
          tema?: string | null
          tese_aplicavel?: string | null
          texto_controlado?: string | null
          tribunal?: string
          updated_at?: string
          validada_humanamente?: boolean
        }
        Relationships: []
      }
      qa_logs_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes_json: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes_json?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes_json?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      qa_metricas_recuperacao: {
        Row: {
          consulta_id: string | null
          created_at: string | null
          foi_utilizada: boolean | null
          fonte_id: string | null
          fonte_tipo: string
          id: string
          score_feedback: number | null
          score_final: number | null
          score_semantico: number | null
          score_textual: number | null
          score_validacao: number | null
        }
        Insert: {
          consulta_id?: string | null
          created_at?: string | null
          foi_utilizada?: boolean | null
          fonte_id?: string | null
          fonte_tipo: string
          id?: string
          score_feedback?: number | null
          score_final?: number | null
          score_semantico?: number | null
          score_textual?: number | null
          score_validacao?: number | null
        }
        Update: {
          consulta_id?: string | null
          created_at?: string | null
          foi_utilizada?: boolean | null
          fonte_id?: string | null
          fonte_tipo?: string
          id?: string
          score_feedback?: number | null
          score_final?: number | null
          score_semantico?: number | null
          score_textual?: number | null
          score_validacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_metricas_recuperacao_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "qa_consultas_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_modelos_docx: {
        Row: {
          arquivo_template_path: string | null
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome_modelo: string
          tipo_peca: string
          updated_at: string
          variaveis_suportadas_json: Json | null
          versao: string
        }
        Insert: {
          arquivo_template_path?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome_modelo: string
          tipo_peca: string
          updated_at?: string
          variaveis_suportadas_json?: Json | null
          versao?: string
        }
        Update: {
          arquivo_template_path?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome_modelo?: string
          tipo_peca?: string
          updated_at?: string
          variaveis_suportadas_json?: Json | null
          versao?: string
        }
        Relationships: []
      }
      qa_monitoramento_configuracoes: {
        Row: {
          config_key: string
          created_at: string
          enabled: boolean
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          created_at?: string
          enabled?: boolean
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          created_at?: string
          enabled?: boolean
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qa_municoes: {
        Row: {
          calibre: string
          cliente_id: number
          created_at: string
          id: string
          marca: string | null
          observacao: string | null
          quantidade: number
          updated_at: string
        }
        Insert: {
          calibre: string
          cliente_id: number
          created_at?: string
          id?: string
          marca?: string | null
          observacao?: string | null
          quantidade?: number
          updated_at?: string
        }
        Update: {
          calibre?: string
          cliente_id?: number
          created_at?: string
          id?: string
          marca?: string | null
          observacao?: string | null
          quantidade?: number
          updated_at?: string
        }
        Relationships: []
      }
      qa_processo_documentos: {
        Row: {
          arquivo_storage_key: string | null
          arquivo_url: string | null
          cliente_id: number
          created_at: string
          dados_extraidos_json: Json | null
          data_envio: string | null
          data_validacao: string | null
          data_validade: string | null
          divergencias_json: Json | null
          etapa: string
          exemplo_url: string | null
          formato_aceito: string[]
          id: string
          instrucoes: string | null
          link_emissao: string | null
          modelo_url: string | null
          motivo_rejeicao: string | null
          nome_documento: string
          obrigatorio: boolean
          observacoes: string | null
          observacoes_cliente: string | null
          orgao_emissor: string | null
          prazo_recomendado_dias: number | null
          processo_id: string
          regra_validacao: Json | null
          revisado_por: string | null
          status: string
          tipo_documento: string
          updated_at: string
          validacao_ia_confianca: number | null
          validacao_ia_erro: string | null
          validacao_ia_modelo: string | null
          validacao_ia_status: string | null
          validade_dias: number | null
        }
        Insert: {
          arquivo_storage_key?: string | null
          arquivo_url?: string | null
          cliente_id: number
          created_at?: string
          dados_extraidos_json?: Json | null
          data_envio?: string | null
          data_validacao?: string | null
          data_validade?: string | null
          divergencias_json?: Json | null
          etapa?: string
          exemplo_url?: string | null
          formato_aceito?: string[]
          id?: string
          instrucoes?: string | null
          link_emissao?: string | null
          modelo_url?: string | null
          motivo_rejeicao?: string | null
          nome_documento: string
          obrigatorio?: boolean
          observacoes?: string | null
          observacoes_cliente?: string | null
          orgao_emissor?: string | null
          prazo_recomendado_dias?: number | null
          processo_id: string
          regra_validacao?: Json | null
          revisado_por?: string | null
          status?: string
          tipo_documento: string
          updated_at?: string
          validacao_ia_confianca?: number | null
          validacao_ia_erro?: string | null
          validacao_ia_modelo?: string | null
          validacao_ia_status?: string | null
          validade_dias?: number | null
        }
        Update: {
          arquivo_storage_key?: string | null
          arquivo_url?: string | null
          cliente_id?: number
          created_at?: string
          dados_extraidos_json?: Json | null
          data_envio?: string | null
          data_validacao?: string | null
          data_validade?: string | null
          divergencias_json?: Json | null
          etapa?: string
          exemplo_url?: string | null
          formato_aceito?: string[]
          id?: string
          instrucoes?: string | null
          link_emissao?: string | null
          modelo_url?: string | null
          motivo_rejeicao?: string | null
          nome_documento?: string
          obrigatorio?: boolean
          observacoes?: string | null
          observacoes_cliente?: string | null
          orgao_emissor?: string | null
          prazo_recomendado_dias?: number | null
          processo_id?: string
          regra_validacao?: Json | null
          revisado_por?: string | null
          status?: string
          tipo_documento?: string
          updated_at?: string
          validacao_ia_confianca?: number | null
          validacao_ia_erro?: string | null
          validacao_ia_modelo?: string | null
          validacao_ia_status?: string | null
          validade_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_processo_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "qa_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_processo_eventos: {
        Row: {
          ator: string | null
          created_at: string
          dados_json: Json | null
          descricao: string | null
          documento_id: string | null
          id: string
          processo_id: string
          tipo_evento: string
          user_id: string | null
        }
        Insert: {
          ator?: string | null
          created_at?: string
          dados_json?: Json | null
          descricao?: string | null
          documento_id?: string | null
          id?: string
          processo_id: string
          tipo_evento: string
          user_id?: string | null
        }
        Update: {
          ator?: string | null
          created_at?: string
          dados_json?: Json | null
          descricao?: string | null
          documento_id?: string | null
          id?: string
          processo_id?: string
          tipo_evento?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_processo_eventos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "qa_processo_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_processo_eventos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "qa_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_processos: {
        Row: {
          cliente_id: number
          condicao_profissional: string | null
          created_at: string
          data_criacao: string
          data_validacao: string | null
          id: string
          observacoes_admin: string | null
          pagamento_id: string | null
          pagamento_status: string
          servico_id: number | null
          servico_nome: string
          status: string
          updated_at: string
          venda_id: number | null
        }
        Insert: {
          cliente_id: number
          condicao_profissional?: string | null
          created_at?: string
          data_criacao?: string
          data_validacao?: string | null
          id?: string
          observacoes_admin?: string | null
          pagamento_id?: string | null
          pagamento_status?: string
          servico_id?: number | null
          servico_nome: string
          status?: string
          updated_at?: string
          venda_id?: number | null
        }
        Update: {
          cliente_id?: number
          condicao_profissional?: string | null
          created_at?: string
          data_criacao?: string
          data_validacao?: string | null
          id?: string
          observacoes_admin?: string | null
          pagamento_id?: string | null
          pagamento_status?: string
          servico_id?: number | null
          servico_nome?: string
          status?: string
          updated_at?: string
          venda_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_processos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "qa_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_referencias_preferenciais: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          motivo_priorizacao: string | null
          origem_id: string
          peso_manual: number | null
          tipo_referencia: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          motivo_priorizacao?: string | null
          origem_id: string
          peso_manual?: number | null
          tipo_referencia: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          motivo_priorizacao?: string | null
          origem_id?: string
          peso_manual?: number | null
          tipo_referencia?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      qa_remove_bg_usage: {
        Row: {
          armamento_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          armamento_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          armamento_id?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      qa_revisoes_pecas: {
        Row: {
          aprovada: boolean | null
          created_at: string | null
          geracao_id: string | null
          id: string
          justificativa: string | null
          texto_original: string | null
          texto_revisado: string | null
          tipo_revisao: string | null
          usuario_id: string | null
          virou_referencia: boolean | null
        }
        Insert: {
          aprovada?: boolean | null
          created_at?: string | null
          geracao_id?: string | null
          id?: string
          justificativa?: string | null
          texto_original?: string | null
          texto_revisado?: string | null
          tipo_revisao?: string | null
          usuario_id?: string | null
          virou_referencia?: boolean | null
        }
        Update: {
          aprovada?: boolean | null
          created_at?: string | null
          geracao_id?: string | null
          id?: string
          justificativa?: string | null
          texto_original?: string | null
          texto_revisado?: string | null
          tipo_revisao?: string | null
          usuario_id?: string | null
          virou_referencia?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_revisoes_pecas_geracao_id_fkey"
            columns: ["geracao_id"]
            isOneToOne: false
            referencedRelation: "qa_geracoes_pecas"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_senha_gov_acessos: {
        Row: {
          acao: string
          cadastro_cr_id: number | null
          cliente_id: number | null
          contexto: string | null
          created_at: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acao: string
          cadastro_cr_id?: number | null
          cliente_id?: number | null
          contexto?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          cadastro_cr_id?: number | null
          cliente_id?: number | null
          contexto?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "qa_senha_gov_acessos_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_cadastro_cr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_senha_gov_acessos_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cadastro_cr_id_sugerido"]
          },
          {
            foreignKeyName: "qa_senha_gov_acessos_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_incident_reconciliation_plan"
            referencedColumns: ["cadastro_cr_id"]
          },
          {
            foreignKeyName: "qa_senha_gov_acessos_cadastro_cr_id_fkey"
            columns: ["cadastro_cr_id"]
            isOneToOne: false
            referencedRelation: "qa_senha_gov_incident_audit"
            referencedColumns: ["cadastro_cr_id"]
          },
        ]
      }
      qa_servicos: {
        Row: {
          id: number
          is_combo: boolean
          nome_servico: string
          valor_servico: number
        }
        Insert: {
          id?: number
          is_combo?: boolean
          nome_servico: string
          valor_servico?: number
        }
        Update: {
          id?: number
          is_combo?: boolean
          nome_servico?: string
          valor_servico?: number
        }
        Relationships: []
      }
      qa_servicos_catalogo: {
        Row: {
          ativo: boolean
          categoria: string
          categoria_servico_slug: string | null
          checklist_type: string | null
          contrato_type: string | null
          created_at: string
          descricao_curta: string | null
          descricao_full: string | null
          display_order: number
          exige_cadastro: boolean
          exige_pagamento: boolean
          gera_processo: boolean
          id: string
          nome: string
          objetivo_slug: string | null
          preco: number | null
          recorrente: boolean
          servico_id: number | null
          servico_principal_slug: string | null
          slug: string
          tipo: string
          tipo_processo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          categoria_servico_slug?: string | null
          checklist_type?: string | null
          contrato_type?: string | null
          created_at?: string
          descricao_curta?: string | null
          descricao_full?: string | null
          display_order?: number
          exige_cadastro?: boolean
          exige_pagamento?: boolean
          gera_processo?: boolean
          id?: string
          nome: string
          objetivo_slug?: string | null
          preco?: number | null
          recorrente?: boolean
          servico_id?: number | null
          servico_principal_slug?: string | null
          slug: string
          tipo?: string
          tipo_processo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          categoria_servico_slug?: string | null
          checklist_type?: string | null
          contrato_type?: string | null
          created_at?: string
          descricao_curta?: string | null
          descricao_full?: string | null
          display_order?: number
          exige_cadastro?: boolean
          exige_pagamento?: boolean
          gera_processo?: boolean
          id?: string
          nome?: string
          objetivo_slug?: string | null
          preco?: number | null
          recorrente?: boolean
          servico_id?: number | null
          servico_principal_slug?: string | null
          slug?: string
          tipo?: string
          tipo_processo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_servicos_catalogo_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "qa_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_servicos_com_exame: {
        Row: {
          ativo: boolean
          created_at: string
          exige_psicologico: boolean
          exige_tiro: boolean
          id: string
          nome_servico: string
          observacoes: string | null
          servico_id: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          exige_psicologico?: boolean
          exige_tiro?: boolean
          id?: string
          nome_servico: string
          observacoes?: string | null
          servico_id: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          exige_psicologico?: boolean
          exige_tiro?: boolean
          id?: string
          nome_servico?: string
          observacoes?: string | null
          servico_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      qa_servicos_documentos: {
        Row: {
          ativo: boolean
          condicao_profissional: string | null
          created_at: string
          etapa: string
          exemplo_url: string | null
          formato_aceito: string[]
          id: string
          instrucoes: string | null
          link_emissao: string | null
          modelo_url: string | null
          nome_documento: string
          obrigatorio: boolean
          observacoes_cliente: string | null
          ordem: number
          orgao_emissor: string | null
          prazo_recomendado_dias: number | null
          regra_validacao: Json | null
          servico_id: number
          tipo_documento: string
          updated_at: string
          validade_dias: number | null
        }
        Insert: {
          ativo?: boolean
          condicao_profissional?: string | null
          created_at?: string
          etapa?: string
          exemplo_url?: string | null
          formato_aceito?: string[]
          id?: string
          instrucoes?: string | null
          link_emissao?: string | null
          modelo_url?: string | null
          nome_documento: string
          obrigatorio?: boolean
          observacoes_cliente?: string | null
          ordem?: number
          orgao_emissor?: string | null
          prazo_recomendado_dias?: number | null
          regra_validacao?: Json | null
          servico_id: number
          tipo_documento: string
          updated_at?: string
          validade_dias?: number | null
        }
        Update: {
          ativo?: boolean
          condicao_profissional?: string | null
          created_at?: string
          etapa?: string
          exemplo_url?: string | null
          formato_aceito?: string[]
          id?: string
          instrucoes?: string | null
          link_emissao?: string | null
          modelo_url?: string | null
          nome_documento?: string
          obrigatorio?: boolean
          observacoes_cliente?: string | null
          ordem?: number
          orgao_emissor?: string | null
          prazo_recomendado_dias?: number | null
          regra_validacao?: Json | null
          servico_id?: number
          tipo_documento?: string
          updated_at?: string
          validade_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_servicos_documentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "qa_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_status_servico: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      qa_status_tipos: {
        Row: {
          id: number
          nome_status: string
          tipo_status: string
        }
        Insert: {
          id?: number
          nome_status: string
          tipo_status?: string
        }
        Update: {
          id?: number
          nome_status?: string
          tipo_status?: string
        }
        Relationships: []
      }
      qa_tempo_validade: {
        Row: {
          id: number
          id_legado: number | null
          nome_configuracao: string
          primeiro_aviso_dias: number | null
          segundo_aviso_dias: number | null
          tempo_dias: number | null
        }
        Insert: {
          id?: number
          id_legado?: number | null
          nome_configuracao: string
          primeiro_aviso_dias?: number | null
          segundo_aviso_dias?: number | null
          tempo_dias?: number | null
        }
        Update: {
          id?: number
          id_legado?: number | null
          nome_configuracao?: string
          primeiro_aviso_dias?: number | null
          segundo_aviso_dias?: number | null
          tempo_dias?: number | null
        }
        Relationships: []
      }
      qa_terceiros: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: number | null
          complemento: string | null
          cpf: string | null
          data_nascimento: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          geolocalizacao: string | null
          id: number
          id_legado: number | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string | null
          numero: string | null
          pais: string | null
          profissao: string | null
          reside_ate: string | null
          reside_desde: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: number | null
          complemento?: string | null
          cpf?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          geolocalizacao?: string | null
          id?: number
          id_legado?: number | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string | null
          numero?: string | null
          pais?: string | null
          profissao?: string | null
          reside_ate?: string | null
          reside_desde?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: number | null
          complemento?: string | null
          cpf?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          geolocalizacao?: string | null
          id?: number
          id_legado?: number | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string | null
          numero?: string | null
          pais?: string | null
          profissao?: string | null
          reside_ate?: string | null
          reside_desde?: string | null
        }
        Relationships: []
      }
      qa_usuarios_perfis: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          perfil: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          perfil?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          perfil?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_venda_eventos: {
        Row: {
          ator: string | null
          cliente_id: number | null
          created_at: string
          dados_json: Json
          descricao: string | null
          id: string
          qa_cliente_id: number | null
          tipo_evento: string
          user_id: string | null
          venda_id: number
        }
        Insert: {
          ator?: string | null
          cliente_id?: number | null
          created_at?: string
          dados_json?: Json
          descricao?: string | null
          id?: string
          qa_cliente_id?: number | null
          tipo_evento: string
          user_id?: string | null
          venda_id: number
        }
        Update: {
          ator?: string | null
          cliente_id?: number | null
          created_at?: string
          dados_json?: Json
          descricao?: string | null
          id?: string
          qa_cliente_id?: number | null
          tipo_evento?: string
          user_id?: string | null
          venda_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_venda_eventos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "qa_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_vendas: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cliente_id: number
          created_at: string
          data_cadastro: string | null
          data_deferimento: string | null
          data_protocolo: string | null
          data_ultima_atualizacao: string | null
          desconto: number | null
          forma_pagamento: string | null
          id: number
          id_legado: number
          motivo_correcao: string | null
          numero_processo: string | null
          origem_proposta: string | null
          status: string
          status_validacao_valor: string | null
          validacao_valor_atualizado_em: string | null
          valor_a_pagar: number | null
          valor_aberto: number
          valor_aprovado: number | null
          valor_informado_cliente: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_id: number
          created_at?: string
          data_cadastro?: string | null
          data_deferimento?: string | null
          data_protocolo?: string | null
          data_ultima_atualizacao?: string | null
          desconto?: number | null
          forma_pagamento?: string | null
          id?: number
          id_legado: number
          motivo_correcao?: string | null
          numero_processo?: string | null
          origem_proposta?: string | null
          status?: string
          status_validacao_valor?: string | null
          validacao_valor_atualizado_em?: string | null
          valor_a_pagar?: number | null
          valor_aberto?: number
          valor_aprovado?: number | null
          valor_informado_cliente?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_id?: number
          created_at?: string
          data_cadastro?: string | null
          data_deferimento?: string | null
          data_protocolo?: string | null
          data_ultima_atualizacao?: string | null
          desconto?: number | null
          forma_pagamento?: string | null
          id?: number
          id_legado?: number
          motivo_correcao?: string | null
          numero_processo?: string | null
          origem_proposta?: string | null
          status?: string
          status_validacao_valor?: string | null
          validacao_valor_atualizado_em?: string | null
          valor_a_pagar?: number | null
          valor_aberto?: number
          valor_aprovado?: number | null
          valor_informado_cliente?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_vendas__cliente_legado"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id_legado"]
          },
          {
            foreignKeyName: "fk_qa_vendas__cliente_legado"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["id_legado"]
          },
          {
            foreignKeyName: "qa_vendas_cliente_id_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id_legado"]
          },
          {
            foreignKeyName: "qa_vendas_cliente_id_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["id_legado"]
          },
          {
            foreignKeyName: "qa_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id_legado"]
          },
          {
            foreignKeyName: "qa_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["id_legado"]
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
      signature_logs: {
        Row: {
          certificate_id: string | null
          contract_id: string | null
          created_at: string
          document_hash: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          original_pdf_path: string | null
          signed_at: string
          signed_pdf_path: string | null
          status: string
          user_agent: string | null
          validation_result: string | null
        }
        Insert: {
          certificate_id?: string | null
          contract_id?: string | null
          created_at?: string
          document_hash?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          original_pdf_path?: string | null
          signed_at?: string
          signed_pdf_path?: string | null
          status?: string
          user_agent?: string | null
          validation_result?: string | null
        }
        Update: {
          certificate_id?: string | null
          contract_id?: string | null
          created_at?: string
          document_hash?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          original_pdf_path?: string | null
          signed_at?: string
          signed_pdf_path?: string | null
          status?: string
          user_agent?: string | null
          validation_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_logs_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificate_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_access_armas: {
        Row: {
          calibre: string | null
          cliente_id_access: string | null
          id_access: string | null
          import_batch: string | null
          imported_at: string
          modelo: string | null
          numero_serie: string | null
          raw: Json | null
        }
        Insert: {
          calibre?: string | null
          cliente_id_access?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          modelo?: string | null
          numero_serie?: string | null
          raw?: Json | null
        }
        Update: {
          calibre?: string | null
          cliente_id_access?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          modelo?: string | null
          numero_serie?: string | null
          raw?: Json | null
        }
        Relationships: []
      }
      staging_access_clientes: {
        Row: {
          cnpj: string | null
          cpf: string | null
          email: string | null
          id_access: string | null
          import_batch: string | null
          imported_at: string
          nome: string | null
          observacoes: string | null
          raw: Json | null
          telefone: string | null
        }
        Insert: {
          cnpj?: string | null
          cpf?: string | null
          email?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          nome?: string | null
          observacoes?: string | null
          raw?: Json | null
          telefone?: string | null
        }
        Update: {
          cnpj?: string | null
          cpf?: string | null
          email?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          nome?: string | null
          observacoes?: string | null
          raw?: Json | null
          telefone?: string | null
        }
        Relationships: []
      }
      staging_access_crafs: {
        Row: {
          arma: string | null
          cliente_id_access: string | null
          id_access: string | null
          import_batch: string | null
          imported_at: string
          numero_craf: string | null
          raw: Json | null
        }
        Insert: {
          arma?: string | null
          cliente_id_access?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          numero_craf?: string | null
          raw?: Json | null
        }
        Update: {
          arma?: string | null
          cliente_id_access?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          numero_craf?: string | null
          raw?: Json | null
        }
        Relationships: []
      }
      staging_access_crs: {
        Row: {
          categoria: string | null
          cliente_id_access: string | null
          id_access: string | null
          import_batch: string | null
          imported_at: string
          numero_cr: string | null
          raw: Json | null
          validade: string | null
        }
        Insert: {
          categoria?: string | null
          cliente_id_access?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          numero_cr?: string | null
          raw?: Json | null
          validade?: string | null
        }
        Update: {
          categoria?: string | null
          cliente_id_access?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          numero_cr?: string | null
          raw?: Json | null
          validade?: string | null
        }
        Relationships: []
      }
      staging_access_senhas_gov: {
        Row: {
          cliente_id_access: string | null
          cpf: string | null
          cr_id_access: string | null
          email: string | null
          id_access: string | null
          import_batch: string | null
          imported_at: string
          numero_cr: string | null
          observacoes: string | null
          raw: Json | null
          senha_plaintext: string | null
        }
        Insert: {
          cliente_id_access?: string | null
          cpf?: string | null
          cr_id_access?: string | null
          email?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          numero_cr?: string | null
          observacoes?: string | null
          raw?: Json | null
          senha_plaintext?: string | null
        }
        Update: {
          cliente_id_access?: string | null
          cpf?: string | null
          cr_id_access?: string | null
          email?: string | null
          id_access?: string | null
          import_batch?: string | null
          imported_at?: string
          numero_cr?: string | null
          observacoes?: string | null
          raw?: Json | null
          senha_plaintext?: string | null
        }
        Relationships: []
      }
      support_tools: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          file_url: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tool_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tool_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tool_type?: string
          updated_at?: string
        }
        Relationships: []
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["lp_app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["lp_app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["lp_app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      qa_cliente_armas: {
        Row: {
          arma_uid: string | null
          calibre: string | null
          created_at: string | null
          fonte: string | null
          marca: string | null
          modelo: string | null
          needs_review: boolean | null
          numero_autorizacao_compra: string | null
          numero_craf: string | null
          numero_serie: string | null
          numero_sigma: string | null
          numero_sinarm: string | null
          qa_cliente_id: number | null
          sistema: string | null
          status_documental: string | null
          tipo_arma: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      qa_clientes_homologacao_dry_run: {
        Row: {
          celular: string | null
          classificacao_sugerida: string | null
          cliente_id: number | null
          cliente_legado_atual: boolean | null
          cpf: string | null
          cpf_duplicado: boolean | null
          email: string | null
          email_duplicado: boolean | null
          homologacao_status_atual: string | null
          id_legado: number | null
          motivo_classificacao: string | null
          nome_completo: string | null
          origem: string | null
          prioridade_homologacao: number | null
          sem_cpf: boolean | null
          tem_arma_manual: boolean | null
          tem_craf: boolean | null
          tem_documento_cliente: boolean | null
          tem_venda_antiga: boolean | null
          tentou_comprar: boolean | null
          tipo_cliente: string | null
          user_id: string | null
        }
        Relationships: []
      }
      qa_clientes_homologacao_kpis: {
        Row: {
          faltam_homologar: number | null
          meta_1_por_dia_dias_restantes: number | null
          total_aguardando_documentos: number | null
          total_cliente_app: number | null
          total_clientes: number | null
          total_documentos_enviados: number | null
          total_em_revisao: number | null
          total_homologado: number | null
          total_legado_pendente: number | null
          total_marcados_legado: number | null
          total_novos_com_portal: number | null
          total_revisar_manual: number | null
          total_tentaram_comprar: number | null
        }
        Relationships: []
      }
      qa_exames_cliente_status: {
        Row: {
          cadastrado_por: string | null
          cadastrado_por_nome: string | null
          cliente_id: number | null
          created_at: string | null
          data_realizacao: string | null
          data_vencimento: string | null
          dias_restantes: number | null
          id: string | null
          marco_alerta_atual: number | null
          observacoes: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          cadastrado_por?: string | null
          cadastrado_por_nome?: string | null
          cliente_id?: number | null
          created_at?: string | null
          data_realizacao?: string | null
          data_vencimento?: string | null
          dias_restantes?: never
          id?: string | null
          marco_alerta_atual?: never
          observacoes?: string | null
          status?: never
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          cadastrado_por?: string | null
          cadastrado_por_nome?: string | null
          cliente_id?: number | null
          created_at?: string | null
          data_realizacao?: string | null
          data_vencimento?: string | null
          dias_restantes?: never
          id?: string | null
          marco_alerta_atual?: never
          observacoes?: string | null
          status?: never
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_exames__cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_gov_password_reconciliation_by_cpf: {
        Row: {
          acao_sugerida: string | null
          cliente_id: number | null
          cpf_norm: string | null
          cr_access_norm: string | null
          cr_access_raw: string | null
          cr_id_alvo: number | null
          email_access: string | null
          email_match: boolean | null
          email_supabase: string | null
          nome_access: string | null
          nome_supabase: string | null
          status: string | null
          tem_senha_access: boolean | null
          tem_senha_sistema: boolean | null
          total_crs_ativos: number | null
        }
        Relationships: []
      }
      qa_gov_password_reconciliation_view: {
        Row: {
          acao_recomendada: string | null
          cadastro_cr_id_sugerido: number | null
          cliente_id_atual_do_cr: number | null
          cliente_id_sugerido: number | null
          cpf_access: string | null
          email_access: string | null
          email_sistema_sugerido: string | null
          hash_senha_access: string | null
          hash_senha_sistema: string | null
          id_access: string | null
          nivel_confianca: string | null
          nome_access: string | null
          nome_atual_do_cr: string | null
          nome_sistema_sugerido: string | null
          numero_cr_access: string | null
          numero_cr_sistema_sugerido: string | null
          status_reconciliacao: string | null
          tem_senha_access: boolean | null
          tem_senha_sistema: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual_do_cr"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual_do_cr"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual_do_cr"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual_do_cr"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_incident_reconciliation_plan: {
        Row: {
          cadastro_cr_id: number | null
          cifrado_em: string | null
          cliente_atual_cpf: string | null
          cliente_atual_id: number | null
          cliente_atual_nome: string | null
          cliente_correto_cpf: string | null
          cliente_correto_id: number | null
          cliente_correto_nome: string | null
          numero_cr: string | null
          senha_alterada_em: string | null
          status_reconciliacao: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_correto_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_correto_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_correto_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_correto_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_atual_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_atual_id"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_atual_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_atual_id"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
      qa_senha_gov_incident_audit: {
        Row: {
          cadastro_cr_id: number | null
          cliente_atual: string | null
          cliente_id_atual: number | null
          cliente_id_migracao: number | null
          cliente_migracao: string | null
          migrado_em: string | null
          numero_cr: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id_migracao"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id_migracao"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id_migracao"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "fk_qa_senha_gov__cliente"
            columns: ["cliente_id_migracao"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual"]
            isOneToOne: false
            referencedRelation: "qa_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual"]
            isOneToOne: false
            referencedRelation: "qa_clientes_homologacao_dry_run"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_by_cpf"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "qa_cadastro_cr_cliente_id_fkey"
            columns: ["cliente_id_atual"]
            isOneToOne: false
            referencedRelation: "qa_gov_password_reconciliation_view"
            referencedColumns: ["cliente_id_sugerido"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["lp_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      qa_arma_manual_upsert: {
        Args: {
          p_calibre: string
          p_cliente_id: number
          p_dados_extraidos_json?: Json
          p_marca: string
          p_modelo: string
          p_numero_autorizacao_compra: string
          p_numero_craf: string
          p_numero_serie: string
          p_numero_sigma: string
          p_numero_sinarm: string
          p_origem: string
          p_sistema: string
          p_tipo_arma: string
          p_user_id: string
        }
        Returns: Json
      }
      qa_arma_norm: { Args: { s: string }; Returns: string }
      qa_atualizar_dados_basicos_cliente: {
        Args: {
          p_bairro?: string
          p_cep?: string
          p_cidade?: string
          p_cliente_id: number
          p_complemento?: string
          p_endereco?: string
          p_estado?: string
          p_estado_civil?: string
          p_numero?: string
          p_profissao?: string
        }
        Returns: boolean
      }
      qa_atualizar_status_homologacao_cliente: {
        Args: { p_cliente_id: number; p_observacao?: string; p_status: string }
        Returns: Json
      }
      qa_busca_auxiliar_caso: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_caso_id: string
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          documento_id: string
          resumo_chunk: string
          similarity: number
          texto_chunk: string
        }[]
      }
      qa_busca_similar: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          documento_id: string
          resumo_chunk: string
          similarity: number
          texto_chunk: string
        }[]
      }
      qa_cliente_criar_conta_publica: {
        Args: {
          p_cpf: string
          p_email: string
          p_nome: string
          p_telefone?: string
          p_user_id: string
        }
        Returns: Json
      }
      qa_cliente_criar_contratacao: {
        Args: {
          p_catalogo_slug: string
          p_observacoes?: string
          p_valor_informado: number
        }
        Returns: Json
      }
      qa_cliente_criar_contratacao_publico: {
        Args: {
          p_catalogo_slug: string
          p_cpf: string
          p_email: string
          p_nome: string
          p_observacoes?: string
          p_telefone: string
          p_valor_informado: number
        }
        Returns: Json
      }
      qa_confirmar_pagamento_processo: {
        Args: { p_origem?: string; p_processo_id: string }
        Returns: Json
      }
      qa_criar_processo_logado: {
        Args: {
          p_catalogo_slug: string
          p_cliente_id: number
          p_observacoes?: string
        }
        Returns: string
      }
      qa_current_cliente_id: { Args: { _uid: string }; Returns: number }
      qa_ensure_cliente_from_auth: {
        Args: {
          p_cpf?: string
          p_email?: string
          p_nome?: string
          p_telefone?: string
        }
        Returns: Json
      }
      qa_explodir_checklist_processo: {
        Args: { p_processo_id: string }
        Returns: {
          inseridos: number
          ja_existentes: number
        }[]
      }
      qa_get_senha_gov_source: {
        Args: { p_cadastro_cr_id?: number; p_cliente_id: number }
        Returns: {
          cadastro_cr_id: number
          credencial_id: number
          source: string
          tem_senha: boolean
        }[]
      }
      qa_gov_recon_cpf_summary: {
        Args: never
        Returns: {
          acao_sugerida: string
          status: string
          total: number
        }[]
      }
      qa_gov_reconcile_build_plan: {
        Args: never
        Returns: {
          cliente_id_atualmente_vinculado: number
          cliente_id_correto: number
          cpf_access: string
          cr_id_no_sistema: number
          id_access: string
          nome_access: string
          nome_cliente_atualmente_vinculado: string
          nome_cliente_correto: string
          numero_cr_access: string
          senha_plaintext: string
          tem_senha_sistema: boolean
        }[]
      }
      qa_gov_reconcile_build_plan_safe: {
        Args: never
        Returns: {
          cliente_id_atualmente_vinculado: number
          cliente_id_correto: number
          cpf_access: string
          cr_id_no_sistema: number
          id_access: string
          nome_access: string
          nome_cliente_atualmente_vinculado: string
          nome_cliente_correto: string
          numero_cr_access: string
          senha_plaintext: string
          tem_senha_sistema: boolean
        }[]
      }
      qa_gov_reconcile_realign_atomic: { Args: never; Returns: Json }
      qa_has_qa_perfil: {
        Args: { _perfis: string[]; _uid: string }
        Returns: boolean
      }
      qa_homologar_cliente: {
        Args: { p_cliente_id: number; p_observacao?: string }
        Returns: Json
      }
      qa_is_active_staff: { Args: { _uid: string }; Returns: boolean }
      qa_listar_municipios_por_uf: {
        Args: { p_uf: string }
        Returns: {
          municipio: string
        }[]
      }
      qa_load_staging_admin: { Args: { p_payload: Json }; Returns: Json }
      qa_load_staging_chunk: { Args: { p_payload: Json }; Returns: Json }
      qa_norm_cr: { Args: { p_cr: string }; Returns: string }
      qa_norm_doc: { Args: { p_doc: string }; Returns: string }
      qa_norm_email: { Args: { p_email: string }; Returns: string }
      qa_norm_nome: { Args: { p_nome: string }; Returns: string }
      qa_reabrir_homologacao_cliente: {
        Args: { p_cliente_id: number; p_motivo: string }
        Returns: Json
      }
      qa_remove_bg_usage_mes: {
        Args: never
        Returns: {
          mes_referencia: string
          total: number
        }[]
      }
      qa_resolve_cliente_id_real: {
        Args: { p_cliente_id_legado: number }
        Returns: number
      }
      qa_resolver_circunscricao_pf: {
        Args: { p_municipio: string; p_uf: string }
        Returns: {
          base_legal: string
          municipio_sede: string
          sigla_unidade: string
          tipo_unidade: string
          uf: string
          unidade_pf: string
        }[]
      }
      qa_sweep_indeferimento_por_prazo: {
        Args: never
        Returns: {
          itens_atualizados: number
        }[]
      }
      qa_venda_aprovar_valor: { Args: { p_venda_id: number }; Returns: Json }
      qa_venda_corrigir_valor: {
        Args: {
          p_motivo: string
          p_valor_corrigido: number
          p_venda_id: number
        }
        Returns: Json
      }
      qa_venda_propor_valor: {
        Args: { p_origem?: string; p_valor: number; p_venda_id: number }
        Returns: Json
      }
      qa_venda_reprovar_valor: {
        Args: { p_motivo: string; p_venda_id: number }
        Returns: Json
      }
      qa_venda_to_processo: {
        Args: {
          p_observacoes?: string
          p_servico_id: number
          p_venda_id: number
        }
        Returns: Json
      }
      qa_verificar_cliente_pode_contratar: {
        Args: { p_catalogo_slug: string; p_cliente_id: number }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      lp_acceptance_type: "checkout_terms" | "contract_signature"
      lp_app_role: "admin" | "client"
      lp_contract_status:
        | "draft"
        | "awaiting_signature"
        | "signed"
        | "cancelled"
      lp_order_status:
        | "pending"
        | "paid"
        | "in_progress"
        | "completed"
        | "cancelled"
      lp_payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "failed"
        | "refunded"
      lp_provider_environment: "sandbox" | "live"
      lp_webhook_event_status:
        | "received"
        | "processing"
        | "processed"
        | "failed"
        | "ignored"
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
    Enums: {
      lp_acceptance_type: ["checkout_terms", "contract_signature"],
      lp_app_role: ["admin", "client"],
      lp_contract_status: [
        "draft",
        "awaiting_signature",
        "signed",
        "cancelled",
      ],
      lp_order_status: [
        "pending",
        "paid",
        "in_progress",
        "completed",
        "cancelled",
      ],
      lp_payment_status: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
      ],
      lp_provider_environment: ["sandbox", "live"],
      lp_webhook_event_status: [
        "received",
        "processing",
        "processed",
        "failed",
        "ignored",
      ],
    },
  },
} as const
