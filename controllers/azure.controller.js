const { DefaultAzureCredential } = require("@azure/identity");
const axios = require("axios");
const FormData = require("form-data");
const {
    keyVaultApi,
    token,
    accessTokenUrl,
    client,
    tenant,
    secret,
    scope,
    grant_type,
} = require("../util/azure");

exports.getTagValues = async (req, res) => {
    try {
        const formData = new FormData();
        formData.append("grant_type", grant_type);
        formData.append("client_id", client);
        formData.append("client_secret", secret);
        formData.append("scope", scope);

        await axios
            .post(accessTokenUrl, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            })
            .then(async (data) => {
                await axios
                    .get(keyVaultApi, {
                        headers: {
                            Authorization: `Bearer ${data?.data?.access_token}`,
                        },
                    })
                    .then((response) => {
                        res.status(200).json({
                            message: "Data retrived Successfully",
                            data: response.data.tags,
                        });
                    });
            });
    } catch (error) {
        console.error("Error fetching secret:", error);
    }
};
