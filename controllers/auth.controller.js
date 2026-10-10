const User = require("../models/user.model");
const nodemailer = require("nodemailer");
const pool = require("../db");
const MailCredentials = require("../util/emailCredential");
const bcrypt = require("bcrypt");

var jwt = require("jsonwebtoken");
const Jwt = require("../util/webJwt");

exports.web_login = async (req, res) => {
    const jwtSecretKey = Jwt.jwtSecretKey;
    const jwtExpiration = Jwt.jwtExpiration;
    const { username, password, communityId } = req.body;
    try {
        const result = await pool.query(
            `SELECT
                u.*,
                c.status AS community_status,
                c.razorpay_account_id AS community_razorpay_account_id
             FROM users u
             LEFT JOIN communities c ON c.id = u.community_id
             WHERE (u.mobile_number = $1 OR u.email = $1)
             AND u.community_id = $2
             LIMIT 1`,
            [username, communityId],
        );
        if (result.rows.length === 0)
            return res.status(401).json({ message: "Invalid credentials" });

        const user = result.rows[0];

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid credentials" });

        if (String(user.status || "").toUpperCase() !== "ACTIVE") {
            return res
                .status(403)
                .json({ message: "User account is not active" });
        }

        if (String(user.community_status || "").toUpperCase() !== "ACTIVE") {
            return res.status(403).json({ message: "Community is inactive" });
        }

        if (!String(user.community_razorpay_account_id || "").trim()) {
            return res
                .status(403)
                .json({ message: "Community payment setup is incomplete" });
        }

        const token = jwt.sign(
            {
                id: user.user_id,
                mobile_number: user.mobile_number,
                community_id: user.community_id,
            },
            jwtSecretKey,
            { expiresIn: jwtExpiration },
        );
        /*Local environment*/
        // res.cookie("nbc_web_token", token, {
        //     httpOnly: true,
        //     secure: false,
        //     sameSite: "Lax",
        //     maxAge: 30 * 24 * 60 * 60 * 1000,
        // });

        /*Dev Server environment*/
       // res.cookie("nbc_web_token", token, {
         //   httpOnly: true,
           // secure: true,
           // sameSite: "None",
           // maxAge: 30 * 24 * 60 * 60 * 1000,
           // domain: "dev.robiz3190.org",
       // });
        /*Prod Server environment*/
         res.cookie("nbc_web_token", token, {
             httpOnly: true,
             secure: true,
             sameSite: "None",
             maxAge: 30 * 24 * 60 * 60 * 1000,
            // domain: "prodv2.robiz3190.org",
	     domain: "prod.biznex.niftrix.com",
         });

        const profile_pic_query = await pool.query(
            "SELECT profile_picture FROM data_collection WHERE user_id = $1",
            [user.user_id],
        );
        return res.status(200).json({
            success: true,
            message: "Login successful",
            firstName: user.firstname,
            profilePic: profile_pic_query.rows[0].profile_picture,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
};

exports.web_logout = (req, res) => {
    /*Local environment*/
    // res.clearCookie("nbc_web_token", {
    //     httpOnly: true,
    //     secure: false,
    //     sameSite: "Lax",
    // });

    /*Dev Server environment*/
   // res.clearCookie("nbc_web_token", {
   //     httpOnly: true,
   //     secure: true,
   //     sameSite: "None",
   //     domain: "dev.robiz3190.org",
  //  });
    /*Prod Server environment*/
     res.clearCookie("nbc_web_token", {
         httpOnly: true,
         secure: true,
         sameSite: "None",
         domain: "prod.biznex.niftrix.com",
     });
    res.status(200).json({ message: "Logged out successfully" });
};

exports.web_getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const { rows } = await pool.query(
            `SELECT 
                u.firstname AS "firstName",
                d.profile_picture AS "profilePic",
                c.name AS "communityName",
                c.logo_url AS "communityLogo"
            FROM users u
            LEFT JOIN data_collection d ON d.user_id = u.user_id
            LEFT JOIN communities c ON c.id = u.community_id
            WHERE u.user_id = $1`,
            [userId],
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error("GET /api/web-profile failed:", err);

        return res.status(500).json({
            error: "Unexpected server error. Please try again later.",
        });
    }
};
exports.forgotPassword = (req, res) => {
    const { email } = req.body;
    User.findOne({
        where: {
            email: email.trim(),
        },
    })
        .then((user) => {
            if (user != undefined || user != null) {
                const otp = generateOTP();
                const currentTime = new Date();
                const futureTime = new Date(
                    currentTime.getTime() + 15 * 60 * 1000,
                );
                user.forgotPasswordOtp = otp;
                user.otpExpiryTime = futureTime;
                user.save();
                if (user.email) {
                    sendEmail(user.email, otp);
                }
                res.status(200).json({
                    //data: user,
                    message: "OTP sent successfully!",
                });
            } else {
                res.status(409).json({ message: "User not found" });
            }
        })
        .catch((error) => {
            res.status(500).json({ message: "Internal server error" });
        });
};

function sendEmail(email, otp) {
    const transporter = nodemailer.createTransport({
        host: MailCredentials.host,
        auth: {
            user: MailCredentials.user,
            pass: MailCredentials.password,
        },
        port: MailCredentials.port,
        secure: true,
        tls: { rejectUnauthorized: false },
    });
    const mailOptions = {
        from: '"ROBIZ OTP VERIFICATION" <robiz3190@niftrix.com>',
        to: email,
        subject: "OTP Verification",
        text: `Hello,\n\nYour OTP is: ${otp}\n\nPlease use this OTP to verify your account.`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            res.status(500).json({ message: "Failed to send OTP via email" });
        } else {
            const newUser = {
                email,
                mobileNumber,
                countryCode,
                isRegistered: false,
                forgotPasswordOtp: otp,
            };
        }
    });
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
}

// exports.verifyForgotPasswordOTP = (req, res) => {
//     const { userId, forgotPasswordOtp } = req.body;
//     // console.log(req.body);
//     User.findByPk(userId)
//         .then((user) => {
//             if (!user) {
//                 res.status(405).json({ message: "User not found" });
//             } else {
//                 const currentTime = new Date();
//                 if (
//                     user.forgotPasswordOtp == forgotPasswordOtp &&
//                     currentTime <= user.otpExpiryTime
//                 ) {
//                     user.isVerified = true;
//                     user.save();
//                     res.status(200).json({
//                         message: "OTP verification successful",
//                         userId: user.userId,
//                         forgotPasswordOtp: user.forgotPasswordOtp,
//                     });
//                 } else {
//                     res.status(400).json({ message: "Invalid OTP" });
//                 }
//             }
//         })
//         .catch((error) => {
//             res.status(500).json({ message: "Internal server error" });
//         });
// };

exports.verifyForgotPasswordOTP = async (req, res) => {
    const { userId, forgotPasswordOtp } = req.body;
    // console.log(req.body);
    User.findByPk(userId)
        .then(async(user) => {
            if (!user) {
                res.status(405).json({ message: "User not found" });
            } else {
                const currentTime = new Date();
                if (
                    user.forgotPasswordOtp == forgotPasswordOtp &&
                    currentTime <= user.otpExpiryTime
                ) {
                    //user.isVerified = true;
                    //user.save();
                    const resetToken = crypto.randomBytes(32).toString("hex");
                    user.resetPasswordToken = resetToken;
                    user.resetPasswordExpires = new Date(
                        Date.now() + 10 * 60 * 1000
                    );
                    user.forgotPasswordOtp = null;
                    user.otpExpiryTime = null;

                    await user.save();
                    res.status(200).json({
                        message: "OTP verification successful",
                        resetToken,
                        //userId: user.userId,
                        //forgotPasswordOtp: user.forgotPasswordOtp,
                    });
                } else {
                    res.status(400).json({ message: "Invalid OTP" });
                }
            }
        })
        .catch((error) => {
            res.status(500).json({ message: "Internal server error" });
        });
};

exports.resendForgotPasswordOTP = (req, res) => {
    const { userId } = req.params;
    User.findByPk(userId)
        .then((user) => {
            if (!user) {
                res.status(404).json({ message: "User not found" });
            } else {
                const newOTP = generateOTP();
                user.forgotPasswordOtp = newOTP;
                user.save();
                const transporter = nodemailer.createTransport({
                    host: MailCredentials.host,
                    auth: {
                        user: MailCredentials.user,
                        pass: MailCredentials.password,
                    },
                    port: MailCredentials.port,
                    secure: true,
                    tls: { rejectUnauthorized: false },
                });
                const mailOptions = {
                    from: '"ROBIZ OTP VERIFICATION" <robiz3190@niftrix.com>',
                    to: user.email,
                    subject: "OTP Verification",
                    text: `Hello,\n\nYour OTP is: ${newOTP}\n\nPlease use this OTP to verify your account.`,
                };
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        res.status(500).json({ message: "Failed to send OTP" });
                    } else {
                        res.status(200).json({
                            message: "OTP resent successfully",
                        });
                    }
                });
            }
        })
        .catch((error) => {
            res.status(500).json({ message: "Internal server error" });
        });
};

// exports.updatePassword = (req, res) => {
//     const { userId, password } = req.body;
//     User.findOne({
//         where: {
//             userId: userId,
//         },
//     })
//         .then((user) => {
//             if (user) {
//                 bcrypt.genSalt(10, (err, salt) => {
//                     if (err) {
//                         res.status(500).json({
//                             message: "Internal server error",
//                         });
//                     } else {
//                         bcrypt.hash(password, salt, (err, hashedPassword) => {
//                             if (err) {
//                                 res.status(500).json({
//                                     message: "Internal server error",
//                                 });
//                             } else {
//                                 user.password = hashedPassword;
//                                 user.save();
//                                 res.status(200).json({
//                                     message: "Password updated successfully!",
//                                 });
//                             }
//                         });
//                     }
//                 });
//             } else {
//                 res.status(404).json({ message: "User not found" });
//             }
//         })
//         .catch((error) => {
//             res.status(500).json({ message: "Internal server error" });
//         });
// };

exports.updatePassword = async (req, res) => {

    try {

        const { resetToken, password } = req.body;

        // Validate required fields
        if (!resetToken || !password) {

            return res.status(400).json({
                message: "resetToken and password are required",
            });
        }

        // Find user using reset token
        const user = await User.findOne({
            where: {
                resetPasswordToken: resetToken,
            },
        });

        // Invalid token
        if (!user) {

            return res.status(400).json({
                message: "Invalid or expired reset token",
            });
        }

        // Expired token check
        if (new Date() > user.resetPasswordExpires) {

            return res.status(400).json({
                message: "Reset token expired",
            });
        }

        // Strong password validation
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

        if (!passwordRegex.test(password)) {

            return res.status(400).json({
                message:
                    "Password must contain minimum 8 characters, uppercase, lowercase, number and special character",
            });
        }

        // Generate salt
        const salt = await bcrypt.genSalt(10);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update password
        user.password = hashedPassword;

        // Clear reset token after successful reset
        user.resetPasswordToken = null;

        user.resetPasswordExpires = null;

        // Save updated user
        await user.save();

        return res.status(200).json({
            message: "Password updated successfully!",
        });

    } catch (error) {

        console.error("Update Password Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};