/**
 * Gerador dinâmico de arquivos de macro do MacroDroid (.macro) para o DataPay Central Pix.
 * Cria o JSON estruturado 100% compatível com a especificação do aplicativo MacroDroid Android.
 */
export function generateMacroDroidConfig(targetIpOrDomain = '192.168.100.21', port = '3000'): string {
  const cleanHost = targetIpOrDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const fullUrl = `http://${cleanHost}:${port}/api/v1/pix`;

  const macroStructure = {
    globalVariables: [],
    macro: {
      aiGenerated: 0,
      breakpoints: [],
      disabledTimestamp: 0,
      exportedActionBlocks: [],
      forceEvenIfNotEnabledTimestamp: 0,
      isActionBlock: false,
      isExtra: false,
      isFavourite: true,
      lastEditedTimestamp: Date.now(),
      localVariables: [],
      localVarsAlphabetical: true,
      m_GUID: -6456878347746494339,
      m_actionList: [
        {
          requestConfig: {
            allFilesAccessPath: "",
            allowAnyCertificate: false,
            basicAuthEnabled: false,
            basicAuthPassword: "",
            basicAuthUsername: "",
            blockNextAction: false,
            clientCertEnabled: false,
            clientCertKeyStoreDisplayName: "",
            clientCertKeyStoreUri: "",
            clientCertPassword: "",
            contentBodyDynamicFileName: "",
            contentBodyFileDisplayName: "",
            contentBodyFileUri: "",
            contentBodyFolderDisplayName: "",
            contentBodyFolderUri: "",
            contentBodySource: 0,
            contentBodyText: "{\"codigo\": \"[clipboard]\"}",
            contentType: "application/json",
            followRedirects: true,
            headerParams: [
              {
                paramName: "Content-Type",
                paramValue: "application/json"
              }
            ],
            localFileUri: "",
            prettifyJson: false,
            queryParams: [],
            requestTimeOutSeconds: 30,
            requestType: 1, // POST
            saveResponseAllFilesAccessPath: "",
            saveResponseFileName: "",
            saveResponseFolderPathDisplayName: "",
            saveResponseFolderPathUri: "",
            saveResponseType: 0,
            saveResponseUseAllFilesAccess: false,
            saveReturnCodeToVariable: false,
            saveReturnHeadersToVariable: false,
            urlToOpen: fullUrl,
            useAllFilesAccess: false,
            useLocalFileUri: false,
            useStaticContentBodyFile: true
          },
          disableLogging: false,
          m_SIGUID: -8768470456724490789,
          m_classType: "HttpRequestAction",
          m_constraintList: [],
          m_isDisabled: false,
          m_isOrCondition: false
        }
      ],
      m_category: "DataPay Automations",
      m_constraintList: [],
      m_description: "Automação Zero-Touch DataPay para ler chaves Pix da Área de Transferência e enviar via REST API ao Central Pix.",
      m_descriptionOpen: false,
      m_enabled: true,
      m_excludeLog: false,
      m_headingColor: -16724737, // Emerald Green accent
      m_isOrCondition: false,
      m_name: "DataPay - Envio Pix Automatico",
      m_triggerList: [
        {
          enableRegex: false,
          ignoreCase: true,
          isConfigured: true,
          m_text: "000201",
          disableLogging: false,
          m_SIGUID: -7756014398699521987,
          m_classType: "ClipboardChangeTrigger",
          m_constraintList: [],
          m_isDisabled: false,
          m_isOrCondition: false
        }
      ]
    },
    macroExportVersion: 1
  };

  return JSON.stringify(macroStructure, null, 2);
}

/**
 * Dispara o download do arquivo .macro direto no navegador do usuário
 */
export function downloadMacroDroidFile(ipAddress = '192.168.100.21') {
  const jsonContent = generateMacroDroidConfig(ipAddress);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `DataPay_Pix_CopiaeCola_${ipAddress.replace(/[^a-zA-Z0-9]/g, '_')}.macro`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
